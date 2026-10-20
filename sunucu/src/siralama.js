// Günlük oyunların puanı (Harfoni Puanı) ve sıralama dönemleri.
// Oyunlar telefonda oynanır; sunucu gönderilen tahminlerin o günün cevabına
// gerçekten ulaştığını kendisi hesaplayarak doğrular.

import { CEVAPLAR, GECERLI, YALIN } from "../../js/kelimeler.js";
import { gununKelimesi, bugununNumarasi } from "../../js/ortak/gunluk.js";

const KATILIM = 5; // bulamayan da oynadığı için bu kadar alır

// Kaçıncı tahminde bulduğuna göre puan
const KLASIK = [100, 80, 60, 40, 25, 10];
const SEKIZ_HAK = [100, 90, 80, 65, 50, 35, 25, 15];
// Arada: 5 tahmine kadar 100, sonra 10'ar azalır, en az 10
const ARADA = Array.from({ length: 15 }, (_, i) => Math.max(10, 100 - Math.max(0, i + 1 - 5) * 10));

export const OYUNLAR = {
  klasik: { hak: 6, puanlar: KLASIK, gecerli: GECERLI },
  palavra: { hak: 8, puanlar: SEKIZ_HAK, gecerli: GECERLI },
  muamma: { hak: 8, puanlar: SEKIZ_HAK, gecerli: GECERLI },
  arada: { hak: 15, puanlar: ARADA, gecerli: YALIN },
};

// Bonuslar: aynı gün dört oyunu da bitirmek ve üst üste günler (seri)
export const DORDU_BONUSU = 20;
export const seriBonusu = (seri) => (seri >= 7 ? 20 : seri >= 3 ? 10 : 0);

const GUN_MS = 24 * 60 * 60 * 1000;
const BASLANGIC = Date.UTC(2026, 9, 1); // 1. gün (Perşembe)

// Geçersizse null, değilse { puan, tahmin } döner.
export function sonucuDegerlendir(oyun, gun, tahminler) {
  const ayar = OYUNLAR[oyun];
  if (!ayar || !Array.isArray(tahminler) || !tahminler.length || tahminler.length > ayar.hak) return null;
  if (!tahminler.every((t) => typeof t === "string" && ayar.gecerli.has(t))) return null;
  const cevap = gununKelimesi(CEVAPLAR, gun, oyun);
  const bulunan = tahminler.indexOf(cevap);
  if (bulunan === -1) return tahminler.length === ayar.hak ? { puan: KATILIM, tahmin: ayar.hak } : null; // yarım oyun
  if (bulunan !== tahminler.length - 1) return null; // bulduktan sonra tahmin olmaz
  return { puan: ayar.puanlar[bulunan], tahmin: bulunan + 1 };
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
