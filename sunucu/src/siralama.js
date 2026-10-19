// Klasik günlük bulmaca puanı ve sıralama dönemleri.
// Oyun telefonda oynanır; sunucu gönderilen tahminlerin o günün cevabına
// gerçekten ulaştığını kendisi hesaplayarak doğrular.

import { CEVAPLAR, GECERLI } from "../../js/kelimeler.js";
import { gununKelimesi, bugununNumarasi } from "../../js/ortak/gunluk.js";

// Kaçıncı tahminde bulduğuna göre puan (bulamazsa 0)
export const PUANLAR = [100, 80, 60, 40, 25, 10];
const HAK = 6;
const GUN_MS = 24 * 60 * 60 * 1000;
const BASLANGIC = Date.UTC(2026, 9, 1); // 1. gün (Perşembe)

// Geçersizse null, değilse { puan, tahmin } döner.
export function sonucuDegerlendir(gun, tahminler) {
  if (!Array.isArray(tahminler) || !tahminler.length || tahminler.length > HAK) return null;
  if (!tahminler.every((t) => typeof t === "string" && GECERLI.has(t))) return null;
  const cevap = gununKelimesi(CEVAPLAR, gun, "klasik");
  const bulunan = tahminler.indexOf(cevap);
  if (bulunan === -1) return tahminler.length === HAK ? { puan: 0, tahmin: HAK } : null; // yarım oyun
  if (bulunan !== tahminler.length - 1) return null; // bulduktan sonra tahmin olmaz
  return { puan: PUANLAR[bulunan], tahmin: bulunan + 1 };
}

// Bariz şüpheli sonuçlar (ör. 10 saniyede ilk tahminde bulmak) sıralamaya girmez.
// sureSn null ise süre bilinmiyor (ör. özellik gelmeden önce oynanmış oyun).
export function supheliMi(tahmin, sureSn) {
  if (sureSn === null) return tahmin === 1;
  if (sureSn < 5) return true;
  if (tahmin === 1 && sureSn < 15) return true;
  return false;
}

// "gun" | "hafta" (pazartesiden itibaren) | "ay" için gün numarası aralığı
export function donemAraligi(donem, bugun = bugununNumarasi()) {
  if (donem === "hafta") {
    const haftaGunu = (new Date(BASLANGIC + (bugun - 1) * GUN_MS).getUTCDay() + 6) % 7; // pazartesi = 0
    return [bugun - haftaGunu, bugun];
  }
  if (donem === "ay") {
    const tarih = new Date(BASLANGIC + (bugun - 1) * GUN_MS);
    const ayBasi = Date.UTC(tarih.getUTCFullYear(), tarih.getUTCMonth(), 1);
    return [Math.round((ayBasi - BASLANGIC) / GUN_MS) + 1, bugun];
  }
  return [bugun, bugun];
}

export { bugununNumarasi };
