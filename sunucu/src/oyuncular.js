// Oyuncu kayıtları: takma ad ve her düello modu için ayrı puan. Tek bir
// Durable Object içinde SQLite tablolarında durur. E-posta, şifre gibi kişisel
// bilgi tutulmaz; oyuncuyu cihazında üretilen rastgele bir kimlik ve gizli
// anahtar tanır.

import { DurableObject } from "cloudflare:workers";

export const BASLANGIC_PUANI = 1000;
export const MOD_ADLARI = ["hizli", "uzun"];
// Aynı iki oyuncu arasında günde en fazla bu kadar maç puana sayılır
// (arkadaşla bilerek kaybedip puan şişirmeyi önlemek için).
export const GUNLUK_ESLI_SINIR = 3;

// K: bir maçta kazanılıp kaybedilebilecek en fazla puan. Satrançtaki (FIDE)
// gibi yeni oyuncunun puanı hızlı yerleşir, yüksek puanlınınki az oynar.
export function kFaktoru({ puan, mac }) {
  if (mac < 20) return 40;
  if (puan >= 1800) return 10;
  return 20;
}

// Satrançtaki Elo hesabı. sonuc: 1 kazandı, 0.5 berabere, 0 kaybetti.
export function yeniPuan(puan, rakipPuani, sonuc, k) {
  const beklenen = 1 / (1 + 10 ** ((rakipPuani - puan) / 400));
  return Math.round(puan + k * (sonuc - beklenen));
}

// Türkiye saatine göre bugünün tarihi (ör. "2026-10-09")
const bugun = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export class Oyuncular extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS oyuncu (
      id TEXT PRIMARY KEY,
      anahtar TEXT NOT NULL,
      ad TEXT NOT NULL,
      puan INTEGER NOT NULL,
      mac INTEGER NOT NULL DEFAULT 0,
      galibiyet INTEGER NOT NULL DEFAULT 0,
      beraberlik INTEGER NOT NULL DEFAULT 0,
      olusturma INTEGER NOT NULL
    )`);
    // Her mod için ayrı puan (satrançtaki blitz ve klasik gibi).
    // oyuncu tablosundaki puan sütunları ilk sürümden kalma, kullanılmıyor.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS derece (
      oyuncu TEXT NOT NULL,
      mod TEXT NOT NULL,
      puan INTEGER NOT NULL,
      mac INTEGER NOT NULL DEFAULT 0,
      galibiyet INTEGER NOT NULL DEFAULT 0,
      beraberlik INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (oyuncu, mod)
    )`);
    // Şikâyetler ve engellemeler
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sikayet (
      no INTEGER PRIMARY KEY AUTOINCREMENT,
      sikayetci TEXT NOT NULL,
      hedef TEXT NOT NULL,
      hedef_ad TEXT NOT NULL,
      sebep TEXT NOT NULL,
      oda TEXT,
      zaman INTEGER NOT NULL,
      acik INTEGER NOT NULL DEFAULT 1
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS engel (
      no INTEGER PRIMARY KEY AUTOINCREMENT,
      engelleyen TEXT NOT NULL,
      engellenen TEXT NOT NULL,
      zaman INTEGER NOT NULL,
      UNIQUE (engelleyen, engellenen)
    )`);
    // Hangi iki oyuncunun bugün kaç puanlı maç yaptığı
    this.sql.exec(`CREATE TABLE IF NOT EXISTS esli_mac (
      a TEXT NOT NULL,
      b TEXT NOT NULL,
      gun TEXT NOT NULL,
      sayi INTEGER NOT NULL,
      PRIMARY KEY (a, b, gun)
    )`);
    // Google/Apple hesabıyla bağlanmış profiller. Sadece hizmetin verdiği
    // değişmez numara (sub) tutulur; e-posta ya da isim tutulmaz.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS hesap (
      saglayici TEXT NOT NULL,
      sub TEXT NOT NULL,
      oyuncu TEXT NOT NULL,
      zaman INTEGER NOT NULL,
      PRIMARY KEY (saglayici, sub)
    )`);
    // Hesapla giriş yapılan her yeni cihazın kendi gizli anahtarı (özeti)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS cihaz (
      oyuncu TEXT NOT NULL,
      anahtar TEXT NOT NULL,
      zaman INTEGER NOT NULL,
      PRIMARY KEY (oyuncu, anahtar)
    )`);
    // Kurallara uymayan oyuncu Düello'dan uzaklaştırılabilir.
    const sutunlar = this.sql.exec("PRAGMA table_info(oyuncu)").toArray().map((s) => s.name);
    if (!sutunlar.includes("yasakli")) this.sql.exec("ALTER TABLE oyuncu ADD COLUMN yasakli INTEGER NOT NULL DEFAULT 0");

    // İlk sürümdeki puanlar hızlı moda taşınır.
    this.sql.exec(`INSERT OR IGNORE INTO derece (oyuncu, mod, puan, mac, galibiyet, beraberlik)
      SELECT id, 'hizli', puan, mac, galibiyet, beraberlik FROM oyuncu`);
  }

  #bul(id) {
    return this.sql.exec("SELECT * FROM oyuncu WHERE id = ?", id).toArray()[0] || null;
  }

  #derece(id, mod) {
    return (
      this.sql.exec("SELECT puan, mac, galibiyet, beraberlik FROM derece WHERE oyuncu = ? AND mod = ?", id, mod).toArray()[0] || {
        puan: BASLANGIC_PUANI,
        mac: 0,
        galibiyet: 0,
        beraberlik: 0,
      }
    );
  }

  // Anahtar doğruysa oyuncunun adını ve her moddaki puanını döner.
  // İlk cihazın anahtarı oyuncu tablosunda, hesapla giriş yapılan diğer
  // cihazlarınki cihaz tablosunda.
  #anahtarDogruMu(oyuncu, anahtar) {
    if (oyuncu.anahtar === anahtar) return true;
    return this.sql.exec("SELECT 1 FROM cihaz WHERE oyuncu = ? AND anahtar = ?", oyuncu.id, anahtar).toArray().length > 0;
  }

  dogrula(id, anahtar) {
    const oyuncu = this.#bul(id);
    if (!oyuncu || !this.#anahtarDogruMu(oyuncu, anahtar)) return null;
    const puanlar = {};
    for (const mod of MOD_ADLARI) puanlar[mod] = this.#derece(id, mod);
    const hesaplar = this.sql.exec("SELECT saglayici FROM hesap WHERE oyuncu = ?", id).toArray().map((h) => h.saglayici);
    return { id, ad: oyuncu.ad, puanlar, hesaplar, yasakli: Boolean(oyuncu.yasakli) };
  }

  // Google/Apple ile giriş. Hesap bir profile bağlıysa o profil için bu
  // cihaza yeni bir anahtar tanımlanır ({ id, yeniCihaz: true }). Bağlı değilse
  // ve cihazdaki profil geçerliyse hesap ona bağlanır. İkisi de değilse null.
  hesapGirisi(saglayici, sub, id, anahtar, yeniAnahtar) {
    const bagli = this.sql.exec("SELECT oyuncu FROM hesap WHERE saglayici = ? AND sub = ?", saglayici, sub).toArray()[0];
    if (bagli && this.#bul(bagli.oyuncu)) {
      if (bagli.oyuncu === id && this.dogrula(id, anahtar)) return { id, yeniCihaz: false };
      this.sql.exec("INSERT OR IGNORE INTO cihaz (oyuncu, anahtar, zaman) VALUES (?, ?, ?)", bagli.oyuncu, yeniAnahtar, Date.now());
      return { id: bagli.oyuncu, yeniCihaz: true };
    }
    if (!this.dogrula(id, anahtar)) return null;
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ? AND saglayici = ?", id, saglayici); // aynı türden eski bağ
    this.sql.exec("INSERT OR REPLACE INTO hesap (saglayici, sub, oyuncu, zaman) VALUES (?, ?, ?, ?)", saglayici, sub, id, Date.now());
    return { id, yeniCihaz: false };
  }

  hesapBaginiKaldir(id, anahtar, saglayici) {
    if (!this.dogrula(id, anahtar)) return false;
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ? AND saglayici = ?", id, saglayici);
    return true;
  }

  // İlk kez görülen kimliği kaydeder, tanınan kimliğin adını günceller.
  kaydet(id, anahtar, ad) {
    const oyuncu = this.#bul(id);
    if (!oyuncu) {
      this.sql.exec(
        "INSERT INTO oyuncu (id, anahtar, ad, puan, olusturma) VALUES (?, ?, ?, ?, ?)",
        id, anahtar, ad, BASLANGIC_PUANI, Date.now()
      );
    } else if (!this.#anahtarDogruMu(oyuncu, anahtar)) {
      return null;
    } else if (ad && ad !== oyuncu.ad) {
      this.sql.exec("UPDATE oyuncu SET ad = ? WHERE id = ?", ad, id);
    }
    return this.dogrula(id, anahtar);
  }

  sil(id, anahtar) {
    if (!this.dogrula(id, anahtar)) return false;
    this.sql.exec("DELETE FROM derece WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM engel WHERE engelleyen = ? OR engellenen = ?", id, id);
    this.sql.exec("DELETE FROM esli_mac WHERE a = ? OR b = ?", id, id);
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM cihaz WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM sikayet WHERE sikayetci = ? OR hedef = ?", id, id);
    this.sql.exec("DELETE FROM oyuncu WHERE id = ?", id);
    return true;
  }

  // Maç bitince iki oyuncunun o moddaki puanını birlikte günceller.
  // sonucA: A oyuncusu için 1 / 0.5 / 0. Silinmiş oyuncu varsa puan değişmez.
  // Aynı ikili bugün sınırı doldurduysa { sinir: true } döner, puan değişmez.
  macSonucu(aId, bId, sonucA, mod) {
    if (!this.#bul(aId) || !this.#bul(bId) || !MOD_ADLARI.includes(mod)) return null;
    const [ilk, ikinci] = [aId, bId].sort();
    const gun = bugun();
    const bugunku = this.sql.exec("SELECT sayi FROM esli_mac WHERE a = ? AND b = ? AND gun = ?", ilk, ikinci, gun).toArray()[0]?.sayi || 0;
    if (bugunku >= GUNLUK_ESLI_SINIR) return { sinir: true };
    this.sql.exec(
      `INSERT INTO esli_mac (a, b, gun, sayi) VALUES (?, ?, ?, 1)
       ON CONFLICT (a, b, gun) DO UPDATE SET sayi = sayi + 1`,
      ilk, ikinci, gun
    );
    this.sql.exec("DELETE FROM esli_mac WHERE gun < ?", gun); // eski günler gereksiz

    const a = this.#derece(aId, mod);
    const b = this.#derece(bId, mod);
    const yeniA = yeniPuan(a.puan, b.puan, sonucA, kFaktoru(a));
    const yeniB = yeniPuan(b.puan, a.puan, 1 - sonucA, kFaktoru(b));
    const guncelle = (id, yeni, sonuc) =>
      this.sql.exec(
        `INSERT INTO derece (oyuncu, mod, puan, mac, galibiyet, beraberlik) VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT (oyuncu, mod) DO UPDATE SET puan = excluded.puan, mac = mac + 1,
           galibiyet = galibiyet + excluded.galibiyet, beraberlik = beraberlik + excluded.beraberlik`,
        id, mod, yeni, sonuc === 1 ? 1 : 0, sonuc === 0.5 ? 1 : 0
      );
    guncelle(aId, yeniA, sonucA);
    guncelle(bId, yeniB, 1 - sonucA);
    return {
      [aId]: { eski: a.puan, yeni: yeniA },
      [bId]: { eski: b.puan, yeni: yeniB },
    };
  }

  // ---------- Şikâyet ve engelleme ----------

  // Aynı kişiyi aynı odadan bir kez şikâyet edebilir. Hedefin açık şikâyet sayısını döner.
  sikayetEt(sikayetci, hedef, sebep, oda) {
    const kisi = this.#bul(hedef);
    if (!kisi) return null;
    const onceden = this.sql.exec("SELECT 1 FROM sikayet WHERE sikayetci = ? AND hedef = ? AND oda IS ?", sikayetci, hedef, oda).toArray().length;
    if (!onceden) {
      this.sql.exec(
        "INSERT INTO sikayet (sikayetci, hedef, hedef_ad, sebep, oda, zaman) VALUES (?, ?, ?, ?, ?, ?)",
        sikayetci, hedef, kisi.ad, sebep, oda, Date.now()
      );
    }
    const acik = this.sql.exec("SELECT COUNT(*) AS n FROM sikayet WHERE hedef = ? AND acik = 1", hedef).one().n;
    return { yeni: !onceden, hedefAd: kisi.ad, acik };
  }

  engelle(engelleyen, engellenen) {
    if (!this.#bul(engellenen)) return false;
    this.sql.exec("INSERT OR IGNORE INTO engel (engelleyen, engellenen, zaman) VALUES (?, ?, ?)", engelleyen, engellenen, Date.now());
    return true;
  }

  // Oyuncunun engellediği kişiler (kimlikleri gösterilmez, sadece ad ve sıra no).
  engeller(id, anahtar) {
    if (!this.dogrula(id, anahtar)) return null;
    return this.sql
      .exec("SELECT e.no, o.ad FROM engel e JOIN oyuncu o ON o.id = e.engellenen WHERE e.engelleyen = ? ORDER BY e.zaman DESC", id)
      .toArray();
  }

  engelKaldir(id, anahtar, no) {
    if (!this.dogrula(id, anahtar)) return false;
    this.sql.exec("DELETE FROM engel WHERE engelleyen = ? AND no = ?", id, no);
    return true;
  }

  // Eşleştirmede birbirine denk getirilmeyecek kişiler (iki yönde de).
  engelliler(id) {
    return this.sql
      .exec("SELECT engellenen AS k FROM engel WHERE engelleyen = ? UNION SELECT engelleyen FROM engel WHERE engellenen = ?", id, id)
      .toArray()
      .map((s) => s.k);
  }

  // ---------- Yönetim ----------

  yonetimListesi() {
    return this.sql
      .exec(
        `SELECT s.no, s.hedef, s.hedef_ad, s.sebep, s.zaman, s.oda,
           o.ad AS guncel_ad, o.yasakli,
           (SELECT COUNT(*) FROM sikayet x WHERE x.hedef = s.hedef AND x.acik = 1) AS acik_sayi
         FROM sikayet s LEFT JOIN oyuncu o ON o.id = s.hedef
         WHERE s.acik = 1 ORDER BY s.zaman DESC LIMIT 200`
      )
      .toArray();
  }

  adSifirla(hedef) {
    const yeni = `Oyuncu ${1000 + Math.floor(Math.random() * 9000)}`;
    this.sql.exec("UPDATE oyuncu SET ad = ? WHERE id = ?", yeni, hedef);
    return yeni;
  }

  yasakla(hedef, yasakli) {
    this.sql.exec("UPDATE oyuncu SET yasakli = ? WHERE id = ?", yasakli ? 1 : 0, hedef);
  }

  // Bir kişi hakkındaki tüm açık şikâyetleri kapatır.
  sikayetleriKapat(hedef) {
    this.sql.exec("UPDATE sikayet SET acik = 0 WHERE hedef = ?", hedef);
  }
}
