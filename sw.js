// Service worker: siteyi internetsiz de açılabilir yapar.
//
// Strateji "önce ağ": internet varsa her zaman en yeni dosya gelir (güncellemeler
// hemen görünür), gelen dosya önbelleğe de yazılır. İnternet yoksa önbellekteki
// son sürüm kullanılır.

const ONBELLEK = "harfoni-v8";

// İlk kurulumda önbelleğe alınanlar; oyunlar internetsiz de açılabilsin.
const DOSYALAR = [
  "./",
  "index.html",
  "klasik.html",
  "palavra.html",
  "arada.html",
  "muamma.html",
  "duello.html",
  "hakkinda.html",
  "gizlilik.html",
  "css/ortak.css",
  "js/kelimeler.js",
  "js/olcum.js",
  "js/uygulama.js",
  "js/ortak/arayuz.js",
  "js/ortak/degerlendir.js",
  "js/ortak/depo.js",
  "js/ortak/gunluk.js",
  "js/ortak/isaretler.js",
  "js/ortak/istatistik.js",
  "js/ortak/klavye.js",
  "js/ortak/rastgele.js",
  "js/ortak/sayfa.js",
  "js/ortak/sunucu.js",
  "js/ortak/tahmin-oyunu.js",
  "js/ortak/turkce.js",
  "js/oyunlar/arada.js",
  "js/oyunlar/duello.js",
  "js/oyunlar/muamma.js",
  "js/oyunlar/klasik.js",
  "js/oyunlar/palavra.js",
  "gorseller/simge-192.png",
  "gorseller/simge-512.png",
  "manifest.webmanifest",
];

self.addEventListener("install", (olay) => {
  olay.waitUntil(caches.open(ONBELLEK).then((onbellek) => onbellek.addAll(DOSYALAR)));
  self.skipWaiting();
});

self.addEventListener("activate", (olay) => {
  // Eski sürüm önbelleklerini temizle.
  olay.waitUntil(
    caches.keys().then((adlar) =>
      Promise.all(adlar.filter((ad) => ad !== ONBELLEK).map((ad) => caches.delete(ad)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (olay) => {
  const istek = olay.request;
  if (istek.method !== "GET" || new URL(istek.url).origin !== location.origin) return;

  // "no-cache": tarayıcının HTTP önbelleğini atla, sunucuya her seferinde sor.
  // Dosya değişmemişse sunucu kısa bir "aynı" cevabı döner, değiştiyse yenisini.
  // Böylece güncellemeler 10 dakikalık önbellek süresini beklemeden görünür.
  const tazeIstek =
    istek.mode === "navigate"
      ? fetch(istek.url, { cache: "no-cache", credentials: "same-origin" })
      : fetch(istek, { cache: "no-cache" });

  olay.respondWith(
    tazeIstek
      .then((yanit) => {
        if (yanit.ok) {
          const kopya = yanit.clone();
          caches.open(ONBELLEK).then((onbellek) => onbellek.put(istek, kopya));
        }
        return yanit;
      })
      .catch(() =>
        caches.match(istek, { ignoreSearch: true }).then((kayitli) => kayitli || caches.match("index.html"))
      )
  );
});
