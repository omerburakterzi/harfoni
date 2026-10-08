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
    return { id, ad: oyuncu.ad, puanlar };
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
}
