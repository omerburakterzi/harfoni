// Oyuncu kayıtları: takma ad ve her düello modu için ayrı puan. Tek bir
// Durable Object içinde SQLite tablolarında durur. E-posta, şifre gibi kişisel
// bilgi tutulmaz; oyuncuyu cihazında üretilen rastgele bir kimlik ve gizli
// anahtar tanır.

import { DurableObject } from "cloudflare:workers";

export const BASLANGIC_PUANI = 1000;
export const MOD_ADLARI = ["hizli", "uzun"];
const K = 32; // bir maçta kazanılıp kaybedilebilecek en fazla puan

// Satrançtaki Elo hesabı. sonuc: 1 kazandı, 0.5 berabere, 0 kaybetti.
export function yeniPuan(puan, rakipPuani, sonuc) {
  const beklenen = 1 / (1 + 10 ** ((rakipPuani - puan) / 400));
  return Math.round(puan + K * (sonuc - beklenen));
}

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
  dogrula(id, anahtar) {
    const oyuncu = this.#bul(id);
    if (!oyuncu || oyuncu.anahtar !== anahtar) return null;
    const puanlar = {};
    for (const mod of MOD_ADLARI) puanlar[mod] = this.#derece(id, mod);
    return { id, ad: oyuncu.ad, puanlar, yasakli: Boolean(oyuncu.yasakli) };
  }

  // İlk kez görülen kimliği kaydeder, tanınan kimliğin adını günceller.
  kaydet(id, anahtar, ad) {
    const oyuncu = this.#bul(id);
    if (!oyuncu) {
      this.sql.exec(
        "INSERT INTO oyuncu (id, anahtar, ad, puan, olusturma) VALUES (?, ?, ?, ?, ?)",
        id, anahtar, ad, BASLANGIC_PUANI, Date.now()
      );
    } else if (oyuncu.anahtar !== anahtar) {
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
    this.sql.exec("DELETE FROM sikayet WHERE sikayetci = ? OR hedef = ?", id, id);
    this.sql.exec("DELETE FROM oyuncu WHERE id = ?", id);
    return true;
  }

  // Maç bitince iki oyuncunun o moddaki puanını birlikte günceller.
  // sonucA: A oyuncusu için 1 / 0.5 / 0. Silinmiş oyuncu varsa puan değişmez.
  macSonucu(aId, bId, sonucA, mod) {
    if (!this.#bul(aId) || !this.#bul(bId) || !MOD_ADLARI.includes(mod)) return null;
    const a = this.#derece(aId, mod);
    const b = this.#derece(bId, mod);
    const yeniA = yeniPuan(a.puan, b.puan, sonucA);
    const yeniB = yeniPuan(b.puan, a.puan, 1 - sonucA);
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
