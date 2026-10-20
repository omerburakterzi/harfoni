// Oyuncu kayıtları: takma ad ve her düello modu için ayrı puan. Tek bir
// Durable Object içinde SQLite tablolarında durur. E-posta, şifre gibi kişisel
// bilgi tutulmaz; oyuncuyu cihazında üretilen rastgele bir kimlik ve gizli
// anahtar tanır.

import { DurableObject } from "cloudflare:workers";
import { DORDU_BONUSU, seriBonusu } from "./siralama.js";

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
    // Apple: profil silinince bağı kaldırabilmek için yenileme jetonu
    const hesapSutunlari = this.sql.exec("PRAGMA table_info(hesap)").toArray().map((s) => s.name);
    if (!hesapSutunlari.includes("yenileme")) {
      this.sql.exec("ALTER TABLE hesap ADD COLUMN yenileme TEXT");
      this.sql.exec("ALTER TABLE hesap ADD COLUMN istemci TEXT");
    }
    // Hesapla giriş yapılan her yeni cihazın kendi gizli anahtarı (özeti)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS cihaz (
      oyuncu TEXT NOT NULL,
      anahtar TEXT NOT NULL,
      zaman INTEGER NOT NULL,
      PRIMARY KEY (oyuncu, anahtar)
    )`);
    // Klasik günlük bulmaca sonuçları (sıralama için). gecerli = 0 olan
    // şüpheli sonuçlar sıralamaya girmez.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS gunluk (
      oyuncu TEXT NOT NULL,
      gun INTEGER NOT NULL,
      puan INTEGER NOT NULL,
      tahmin INTEGER NOT NULL,
      sure INTEGER NOT NULL,
      gecerli INTEGER NOT NULL,
      zaman INTEGER NOT NULL,
      PRIMARY KEY (oyuncu, gun)
    )`);
    this.sql.exec("CREATE INDEX IF NOT EXISTS gunluk_gun ON gunluk (gun)");
    // Dört günlük oyunun sonuçları (Harfoni Puanı). gunluk tablosu ilk
    // sürümden kalma (sadece Klasik), içindekiler buraya taşınır.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sonuc (
      oyuncu TEXT NOT NULL,
      gun INTEGER NOT NULL,
      oyun TEXT NOT NULL,
      puan INTEGER NOT NULL,
      tahmin INTEGER NOT NULL,
      sure INTEGER NOT NULL,
      gecerli INTEGER NOT NULL,
      zaman INTEGER NOT NULL,
      PRIMARY KEY (oyuncu, gun, oyun)
    )`);
    this.sql.exec("CREATE INDEX IF NOT EXISTS sonuc_gun ON sonuc (gun)");
    // Oyuncunun her günü: kaç oyun bitirdi, serisi kaç gün, bonusu ne.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS gun_ozet (
      oyuncu TEXT NOT NULL,
      gun INTEGER NOT NULL,
      oyun_sayisi INTEGER NOT NULL,
      seri INTEGER NOT NULL,
      bonus INTEGER NOT NULL,
      PRIMARY KEY (oyuncu, gun)
    )`);
    if (!this.sql.exec("SELECT 1 FROM sonuc LIMIT 1").toArray().length) {
      const eskiler = this.sql.exec("SELECT * FROM gunluk ORDER BY gun").toArray();
      for (const e of eskiler) {
        this.sql.exec(
          "INSERT OR IGNORE INTO sonuc (oyuncu, gun, oyun, puan, tahmin, sure, gecerli, zaman) VALUES (?, ?, 'klasik', ?, ?, ?, ?, ?)",
          e.oyuncu, e.gun, e.puan, e.tahmin, e.sure, e.gecerli, e.zaman
        );
        if (e.gecerli) this.#gunuGuncelle(e.oyuncu, e.gun);
      }
    }
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
  // ek: { yenileme, istemci } (Apple için, varsa)
  hesapGirisi(saglayici, sub, id, anahtar, yeniAnahtar, ek = {}) {
    const bagli = this.sql.exec("SELECT oyuncu FROM hesap WHERE saglayici = ? AND sub = ?", saglayici, sub).toArray()[0];
    if (bagli && ek.yenileme) {
      this.sql.exec("UPDATE hesap SET yenileme = ?, istemci = ? WHERE saglayici = ? AND sub = ?", ek.yenileme, ek.istemci, saglayici, sub);
    }
    if (bagli && this.#bul(bagli.oyuncu)) {
      if (bagli.oyuncu === id && this.dogrula(id, anahtar)) return { id, yeniCihaz: false };
      this.sql.exec("INSERT OR IGNORE INTO cihaz (oyuncu, anahtar, zaman) VALUES (?, ?, ?)", bagli.oyuncu, yeniAnahtar, Date.now());
      return { id: bagli.oyuncu, yeniCihaz: true };
    }
    if (!this.dogrula(id, anahtar)) return null;
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ? AND saglayici = ?", id, saglayici); // aynı türden eski bağ
    this.sql.exec(
      "INSERT OR REPLACE INTO hesap (saglayici, sub, oyuncu, zaman, yenileme, istemci) VALUES (?, ?, ?, ?, ?, ?)",
      saglayici, sub, id, Date.now(), ek.yenileme || null, ek.istemci || null
    );
    return { id, yeniCihaz: false };
  }

  // Kaldırılan bağların Apple jetonlarını döner (Apple'a da bildirmek için).
  hesapBaginiKaldir(id, anahtar, saglayici) {
    if (!this.dogrula(id, anahtar)) return null;
    const jetonlar = this.#appleJetonlari(id, saglayici);
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ? AND saglayici = ?", id, saglayici);
    return jetonlar;
  }

  #appleJetonlari(id, saglayici = "apple") {
    return this.sql
      .exec("SELECT yenileme, istemci FROM hesap WHERE oyuncu = ? AND saglayici = ? AND yenileme IS NOT NULL", id, saglayici)
      .toArray();
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

  // Silinen profilin Apple jetonlarını döner ya da kimlik yanlışsa null.
  sil(id, anahtar) {
    if (!this.dogrula(id, anahtar)) return null;
    const jetonlar = this.#appleJetonlari(id);
    this.sql.exec("DELETE FROM derece WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM engel WHERE engelleyen = ? OR engellenen = ?", id, id);
    this.sql.exec("DELETE FROM esli_mac WHERE a = ? OR b = ?", id, id);
    this.sql.exec("DELETE FROM hesap WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM cihaz WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM gunluk WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM sonuc WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM gun_ozet WHERE oyuncu = ?", id);
    this.sql.exec("DELETE FROM sikayet WHERE sikayetci = ? OR hedef = ?", id, id);
    this.sql.exec("DELETE FROM oyuncu WHERE id = ?", id);
    return jetonlar;
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

  // ---------- Günlük oyun sıralaması (Harfoni Puanı) ----------

  // O günün oyun sayısını, serisini ve bonusunu yeniden hesaplar.
  #gunuGuncelle(id, gun) {
    const oyunSayisi = this.sql.exec("SELECT COUNT(*) AS n FROM sonuc WHERE oyuncu = ? AND gun = ? AND gecerli = 1", id, gun).one().n;
    if (!oyunSayisi) return;
    const dun = this.sql.exec("SELECT seri FROM gun_ozet WHERE oyuncu = ? AND gun = ?", id, gun - 1).toArray()[0];
    const seri = dun ? dun.seri + 1 : 1;
    const bonus = (oyunSayisi >= 4 ? DORDU_BONUSU : 0) + seriBonusu(seri);
    this.sql.exec(
      `INSERT INTO gun_ozet (oyuncu, gun, oyun_sayisi, seri, bonus) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (oyuncu, gun) DO UPDATE SET oyun_sayisi = excluded.oyun_sayisi, seri = excluded.seri, bonus = excluded.bonus`,
      id, gun, oyunSayisi, seri, bonus
    );
  }

  // Her oyuncunun her gün her oyun için ilk gönderdiği sonuç geçerlidir.
  sonucKaydet(id, anahtar, oyun, gun, puan, tahmin, sure, gecerli) {
    if (!this.dogrula(id, anahtar)) return null;
    this.sql.exec(
      "INSERT OR IGNORE INTO sonuc (oyuncu, gun, oyun, puan, tahmin, sure, gecerli, zaman) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id, gun, oyun, puan, tahmin, sure, gecerli ? 1 : 0, Date.now()
    );
    this.#gunuGuncelle(id, gun);
    // Dünkü sonuç bugünden sonra geldiyse bugünün serisi de değişir.
    if (this.sql.exec("SELECT 1 FROM gun_ozet WHERE oyuncu = ? AND gun = ?", id, gun + 1).toArray().length) this.#gunuGuncelle(id, gun + 1);
    const kayit = this.sql.exec("SELECT puan, gecerli FROM sonuc WHERE oyuncu = ? AND gun = ? AND oyun = ?", id, gun, oyun).one();
    const ozet = this.sql.exec("SELECT oyun_sayisi, seri, bonus FROM gun_ozet WHERE oyuncu = ? AND gun = ?", id, gun).toArray()[0];
    return { puan: kayit.puan, gecerli: Boolean(kayit.gecerli), seri: ozet?.seri || 0, bonus: ozet?.bonus || 0, oyunSayisi: ozet?.oyun_sayisi || 0 };
  }

  // ilk..son günleri arasındaki puana göre sıralama. oyun verilirse sadece o
  // oyunun puanı, verilmezse dört oyunun toplamı + bonuslar. Eşitlikte daha
  // kısa toplam süre önde. id verilirse o oyuncunun sırası da döner.
  siralama(ilk, son, id, oyun = null) {
    const puanlar = oyun
      ? "SELECT oyuncu, puan, sure FROM sonuc WHERE gun BETWEEN ?1 AND ?2 AND gecerli = 1 AND oyun = ?3"
      : `SELECT oyuncu, puan, sure FROM sonuc WHERE gun BETWEEN ?1 AND ?2 AND gecerli = 1
         UNION ALL SELECT oyuncu, bonus, 0 FROM gun_ozet WHERE gun BETWEEN ?1 AND ?2`;
    const sorgu = `SELECT p.oyuncu, o.ad, SUM(p.puan) AS puan, SUM(p.sure) AS sure
      FROM (${puanlar}) p JOIN oyuncu o ON o.id = p.oyuncu
      WHERE o.yasakli = 0 GROUP BY p.oyuncu`;
    const ek = oyun ? [ilk, son, oyun] : [ilk, son];
    const liste = this.sql.exec(`${sorgu} ORDER BY puan DESC, sure ASC LIMIT 50`, ...ek).toArray();
    const toplam = this.sql.exec(`SELECT COUNT(*) AS n FROM (${sorgu})`, ...ek).one().n;
    let ben = null;
    if (id) {
      const benim = this.sql.exec(`SELECT * FROM (${sorgu}) WHERE oyuncu = ?${ek.length + 1}`, ...ek, id).toArray()[0];
      if (benim) {
        const onde = this.sql
          .exec(
            `SELECT COUNT(*) AS n FROM (${sorgu}) WHERE puan > ?${ek.length + 1} OR (puan = ?${ek.length + 1} AND sure < ?${ek.length + 2})`,
            ...ek, benim.puan, benim.sure
          )
          .one().n;
        ben = { sira: onde + 1, puan: benim.puan, yuzde: Math.max(1, Math.ceil(((onde + 1) / toplam) * 100)) };
      }
    }
    return {
      toplam,
      liste: liste.map((s, i) => ({ sira: i + 1, ad: s.ad, puan: s.puan, ben: s.oyuncu === id })),
      ben,
    };
  }

  // Oyuncunun güncel serisi (bugün ya da dün oynadıysa devam ediyor).
  seri(id, bugun) {
    const son = this.sql.exec("SELECT gun, seri FROM gun_ozet WHERE oyuncu = ? ORDER BY gun DESC LIMIT 1", id).toArray()[0];
    return son && son.gun >= bugun - 1 ? son.seri : 0;
  }
}
