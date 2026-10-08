// Harfoni Bot: gerçek bir oyuncu gibi sadece kendi tahminlerinin renklerine
// bakarak oynar; cevabı ya da rakibinin harflerini görmez.
//
// Her tahminde, o ana kadarki renklerle uyumlu kelimeler arasından seçer.
// Kolay ve Orta seviyede bazen sadece yeşil harflere bakıp gerisini kaçırır.
// Zor seviye uyumlu kelimeler arasından en çok bilgi vereni seçer.

import { CEVAPLAR } from "../../js/kelimeler.js";
import { degerlendir } from "../../js/ortak/degerlendir.js";

export const BOT_ID = "bot";
export const BOT_SEVIYELERI = {
  // tutarli: renklerin hepsine uyan kelime seçme olasılığı
  // gecikme: her tahmin öncesi "düşünme" süresi (ms)
  kolay: { ad: "Kolay", tutarli: 0.35, gecikme: [18000, 35000] },
  orta: { ad: "Orta", tutarli: 0.7, gecikme: [12000, 26000] },
  zor: { ad: "Zor", tutarli: 1, gecikme: [7000, 16000] },
};

const rastgele = (liste) => liste[Math.floor(Math.random() * liste.length)];

// Kalan ihtimalleri en iyi bölen açılışlar (cevap listesi üzerinde önceden hesaplandı).
const ZOR_ACILISLAR = ["kenar", "merak", "raket", "keman", "inkar"];

// Kalan ihtimalleri en küçük gruplara bölen tahmin (grup büyüklüklerinin
// karelerinin toplamı en küçük olan). Hız için en fazla 120 aday denenir.
function enBilgili(tutarli) {
  if (tutarli.length <= 2) return rastgele(tutarli);
  const denenecek = tutarli.length > 120 ? [...tutarli].sort(() => Math.random() - 0.5).slice(0, 120) : tutarli;
  let enIyi = null;
  let enIyiPuan = Infinity;
  for (const tahmin of denenecek) {
    const gruplar = new Map();
    for (const cevap of tutarli) {
      const anahtar = degerlendir(tahmin, cevap).join();
      gruplar.set(anahtar, (gruplar.get(anahtar) || 0) + 1);
    }
    let puan = 0;
    for (const n of gruplar.values()) puan += n * n;
    if (puan < enIyiPuan) [enIyi, enIyiPuan] = [tahmin, puan];
  }
  return enIyi;
}

export function botGecikmesi(seviye) {
  const [en, ec] = BOT_SEVIYELERI[seviye].gecikme;
  return en + Math.random() * (ec - en);
}

export function botTahmini(oncekiler, cevap, seviye) {
  const sonuclar = oncekiler.map((t) => [t, degerlendir(t, cevap)]);
  const ayni = (a, b) => a.every((d, i) => d === b[i]);
  // Bu kelime cevap olsaydı şimdiye kadarki renkler aynı mı çıkardı?
  const uyumlu = (aday) => sonuclar.every(([t, renk]) => ayni(degerlendir(t, aday), renk));
  // Sadece yeşil harfleri tutturan (turuncu ve griyi umursamayan) kelimeler
  const yesileUyan = (aday) => sonuclar.every(([t, renk]) => renk.every((d, i) => d !== "dogru" || aday[i] === t[i]));

  const adaylar = CEVAPLAR.filter((k) => !oncekiler.includes(k));
  if (!oncekiler.length) return seviye === "zor" ? rastgele(ZOR_ACILISLAR) : rastgele(adaylar);
  const tutarli = adaylar.filter(uyumlu);
  if (seviye === "zor" && tutarli.length) return enBilgili(tutarli);
  if (tutarli.length && Math.random() < BOT_SEVIYELERI[seviye].tutarli) return rastgele(tutarli);
  const yari = adaylar.filter(yesileUyan);
  return rastgele(yari.length ? yari : adaylar);
}
