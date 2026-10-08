// Oyuncu kayıtları: takma ad ve düello puanı. Tek bir Durable Object içinde
// SQLite tablosunda durur. E-posta, şifre gibi kişisel bilgi tutulmaz;
// oyuncuyu cihazında üretilen rastgele bir kimlik ve gizli anahtar tanır.

import { DurableObject } from "cloudflare:workers";

export const BASLANGIC_PUANI = 1000;
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
  }

  #bul(id) {
    return this.sql.exec("SELECT * FROM oyuncu WHERE id = ?", id).toArray()[0] || null;
  }

  // Anahtar doğruysa oyuncunun herkese açık bilgilerini döner.
  dogrula(id, anahtar) {
    const oyuncu = this.#bul(id);
    if (!oyuncu || oyuncu.anahtar !== anahtar) return null;
    const { anahtar: _, olusturma, ...acik } = oyuncu;
    return acik;
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
    this.sql.exec("DELETE FROM oyuncu WHERE id = ?", id);
    return true;
  }

  // Maç bitince iki oyuncunun puanını birlikte günceller.
  // sonucA: A oyuncusu için 1 / 0.5 / 0. Silinmiş oyuncu varsa puan değişmez.
  macSonucu(aId, bId, sonucA) {
    const a = this.#bul(aId);
    const b = this.#bul(bId);
    if (!a || !b) return null;
    const yeniA = yeniPuan(a.puan, b.puan, sonucA);
    const yeniB = yeniPuan(b.puan, a.puan, 1 - sonucA);
    const guncelle = (o, yeni, sonuc) =>
      this.sql.exec(
        "UPDATE oyuncu SET puan = ?, mac = mac + 1, galibiyet = galibiyet + ?, beraberlik = beraberlik + ? WHERE id = ?",
        yeni, sonuc === 1 ? 1 : 0, sonuc === 0.5 ? 1 : 0, o.id
      );
    guncelle(a, yeniA, sonucA);
    guncelle(b, yeniB, 1 - sonucA);
    return {
      [aId]: { eski: a.puan, yeni: yeniA },
      [bId]: { eski: b.puan, yeni: yeniB },
    };
  }
}
