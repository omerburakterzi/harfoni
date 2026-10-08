// Harfoni sunucusu: oyuncu kaydı ve düello odaları.
//
//   POST /oyuncu          { id, anahtar, ad }  kaydol ya da adını güncelle
//   POST /oyuncu/bilgi    { id, anahtar }      puanını ve maç sayılarını al
//   POST /oyuncu/sil      { id, anahtar }      tüm bilgilerini sil
//   POST /duello          { mod }              yeni oda aç (hizli | uzun), kodunu al
//   GET  /duello/KOD      (WebSocket)          odaya bağlan

import { anahtarOzeti } from "./ozet.js";

export { DuelloOdasi } from "./oda.js";
export { Oyuncular } from "./oyuncular.js";

// Karıştırılabilecek harfler (O/0, I/1, L) kodda yok.
const KOD_HARFLERI = "ABCDEFGHJKMNPRSTUVYZ23456789";
const KIMLIK = /^[0-9a-f]{32}$/;

function izinliKaynak(kaynak) {
  if (!kaynak) return false;
  if (["https://harfoni.com", "https://www.harfoni.com", "capacitor://localhost", "https://localhost"].includes(kaynak)) return true;
  // Geliştirme: kendi bilgisayarımız ve evdeki ağ
  return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(kaynak);
}

function cevap(veri, kaynak, durum = 200) {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(izinliKaynak(kaynak) ? { "Access-Control-Allow-Origin": kaynak, Vary: "Origin" } : {}),
    },
  });
}

// Takma ad: 2-16 karakter; harf, rakam, boşluk ve _ . - olabilir.
function adTemizle(ad) {
  const temiz = String(ad || "").replace(/\s+/g, " ").trim();
  if ([...temiz].length < 2 || [...temiz].length > 16) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(temiz)) return null;
  return temiz;
}

function kodUret() {
  const sayilar = crypto.getRandomValues(new Uint8Array(6));
  return [...sayilar].map((s) => KOD_HARFLERI[s % KOD_HARFLERI.length]).join("");
}

export default {
  async fetch(istek, env) {
    const url = new URL(istek.url);
    const kaynak = istek.headers.get("Origin");

    if (istek.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: izinliKaynak(kaynak)
          ? {
              "Access-Control-Allow-Origin": kaynak,
              "Access-Control-Allow-Methods": "GET, POST",
              "Access-Control-Allow-Headers": "Content-Type",
              "Access-Control-Max-Age": "86400",
              Vary: "Origin",
            }
          : {},
      });
    }

    const oyuncular = env.OYUNCULAR.get(env.OYUNCULAR.idFromName("tum"));

    // Düello odasına WebSocket bağlantısı
    const odaYolu = url.pathname.match(/^\/duello\/([A-Z0-9]{6})$/);
    if (odaYolu && istek.method === "GET") {
      if (kaynak && !izinliKaynak(kaynak)) return new Response("İzin yok", { status: 403 });
      const oda = env.ODALAR.get(env.ODALAR.idFromName(odaYolu[1]));
      return oda.fetch(istek);
    }

    if (istek.method !== "POST") return cevap({ ad: "Harfoni sunucusu" }, kaynak);

    if (url.pathname === "/duello") {
      const { mod } = await istek.json().catch(() => ({}));
      for (let deneme = 0; deneme < 5; deneme++) {
        const kod = kodUret();
        const oda = env.ODALAR.get(env.ODALAR.idFromName(kod));
        if (await oda.kur(kod, mod)) return cevap({ kod }, kaynak);
      }
      return cevap({ hata: "Oda açılamadı, tekrar dene" }, kaynak, 500);
    }

    let govde;
    try {
      govde = await istek.json();
    } catch {
      return cevap({ hata: "Geçersiz istek" }, kaynak, 400);
    }
    const { id, anahtar } = govde;
    if (!KIMLIK.test(id) || !KIMLIK.test(anahtar)) return cevap({ hata: "Geçersiz kimlik" }, kaynak, 400);
    const ozet = await anahtarOzeti(anahtar);

    if (url.pathname === "/oyuncu") {
      const ad = adTemizle(govde.ad);
      if (!ad) return cevap({ hata: "Ad 2-16 karakter olmalı; harf, rakam ve boşluk kullanabilirsin" }, kaynak, 400);
      const oyuncu = await oyuncular.kaydet(id, ozet, ad);
      return oyuncu ? cevap(oyuncu, kaynak) : cevap({ hata: "Kimlik doğrulanamadı" }, kaynak, 403);
    }
    if (url.pathname === "/oyuncu/bilgi") {
      const oyuncu = await oyuncular.dogrula(id, ozet);
      return oyuncu ? cevap(oyuncu, kaynak) : cevap({ hata: "Oyuncu bulunamadı" }, kaynak, 404);
    }
    if (url.pathname === "/oyuncu/sil") {
      return cevap({ silindi: await oyuncular.sil(id, ozet) }, kaynak);
    }
    return cevap({ hata: "Bulunamadı" }, kaynak, 404);
  },
};
