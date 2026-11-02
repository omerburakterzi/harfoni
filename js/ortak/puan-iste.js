// Mağaza uygulamasında, günlük bulmacayı 3 farklı gün çözen oyuncuya mağazanın
// kendi "Puan ver" penceresini gösterir. Tarayıcıda hiçbir şey yapmaz.
// Pencerenin gerçekten çıkıp çıkmayacağına Apple/Google karar verir
// (yılda birkaç kez sınırı var); biz 4 ayda bir en fazla bir kez isteriz.

const ANAHTAR = "harfoni.degerlendirme";
const GEREKEN_GUN = 3;
const ARALIK = 120 * 864e5;

export function cozulduysePuanIste(gun) {
  const eklenti = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.InAppReview;
  if (!eklenti) return;
  let kayit = { gunler: [], istendi: 0 };
  try {
    kayit = { ...kayit, ...JSON.parse(localStorage.getItem(ANAHTAR) || "{}") };
  } catch {}
  if (!kayit.gunler.includes(gun)) kayit.gunler = [...kayit.gunler, gun].slice(-10);
  const zamani = kayit.gunler.length >= GEREKEN_GUN && Date.now() - kayit.istendi > ARALIK;
  if (zamani) kayit.istendi = Date.now();
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(kayit));
  } catch {}
  // Sonuç penceresi açıldıktan sonra, oyuncu sonucunu görmüşken.
  if (zamani) setTimeout(() => eklenti.requestReview().catch(() => {}), 3500);
}
