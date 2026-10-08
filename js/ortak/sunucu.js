// Harfoni sunucusunun adresi. Kendi bilgisayarımızda denerken yerel sunucu
// (npm run gelistir, sunucu/ klasöründe) kullanılır.

const uygulamada = Boolean(window.Capacitor);
export const YEREL = !uygulamada && /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);

export const SUNUCU = YEREL ? `http://${location.hostname}:8787` : "https://api.harfoni.com";
export const WS_SUNUCU = SUNUCU.replace(/^http/, "ws");

// Davet bağlantıları her zaman siteyi açar; arkadaşın uygulamayı yüklemeden oynayabilir.
export const DUELLO_ADRESI = YEREL ? location.origin + location.pathname : "https://harfoni.com/duello.html";

export async function istek(yol, govde) {
  let yanit;
  try {
    yanit = await fetch(SUNUCU + yol, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde || {}),
    });
  } catch {
    throw Object.assign(new Error("Sunucuya bağlanılamadı. İnternet bağlantını kontrol et."), { durum: 0 });
  }
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) throw Object.assign(new Error(veri.hata || "Bir şeyler ters gitti"), { durum: yanit.status });
  return veri;
}
