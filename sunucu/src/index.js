// Harfoni sunucusu: oyuncu kaydı ve düello odaları.
//
//   POST /oyuncu          { id, anahtar, ad }  kaydol ya da adını güncelle
//   POST /oyuncu/bilgi    { id, anahtar }      puanını ve maç sayılarını al
//   POST /oyuncu/sil      { id, anahtar }      tüm bilgilerini sil
//   POST /duello          { mod, bot?, puansiz? }  yeni oda aç (hizli | uzun; bot: kolay | orta | zor)
//   GET  /duello/KOD      (WebSocket)          odaya bağlan
//   GET  /eslestir        (WebSocket)          rastgele rakip ara
//   POST /oyuncu/engeller { id, anahtar }      engellediğin kişiler
//   POST /oyuncu/engel-kaldir { id, anahtar, no }
//   POST /giris           { id, anahtar, saglayici, jeton, kod?, istemci? }  Google/Apple ile bağla ya da giriş yap
//   POST /giris/kaldir    { id, anahtar, saglayici }         hesap bağını kaldır
//   GET  /yonetim                              şikâyetleri inceleme sayfası

import { anahtarOzeti } from "./ozet.js";
import { odaAc } from "./kod.js";
import { YONETIM_SAYFASI, yetkiliMi } from "./yonetim.js";
import { jetonuDogrula } from "./giris.js";
import { yenilemeJetonuAl, bagiKaldir } from "./apple.js";

export { DuelloOdasi } from "./oda.js";
export { Oyuncular } from "./oyuncular.js";
export { Eslestirme } from "./eslestirme.js";

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

// Takma adlar rastgele rakiplere de göründüğü için kaba sözler engellenir.
// Uzun kökler kelimenin içinde de aranır; kısalar sadece tek başına kelimeyse
// (ör. "klasik" içindeki "sik" sorun değil).
const YASAK_KOKLER = ["orospu", "yarrak", "amcık", "amına", "amina", "siktir", "sikerim", "sikik", "pezevenk", "kahpe", "yavşak", "şerefsiz", "kaltak", "dalyarak", "taşak", "gavat", "puşt", "fuck", "bitch", "porno", "pussy", "dick"];
const YASAK_KELIMELER = ["amk", "aq", "oç", "piç", "sik", "göt", "ibne", "sex", "seks", "am"];

function kabaMi(ad) {
  const kucuk = ad.toLocaleLowerCase("tr-TR");
  const bitisik = kucuk.replace(/[^\p{L}]/gu, "");
  if (YASAK_KOKLER.some((kok) => bitisik.includes(kok))) return true;
  return kucuk.split(/[^\p{L}]+/u).some((kelime) => YASAK_KELIMELER.includes(kelime));
}

// Takma ad: 2-16 karakter; harf, rakam, boşluk ve _ . - olabilir.
function adTemizle(ad) {
  const temiz = String(ad || "").replace(/\s+/g, " ").trim();
  if ([...temiz].length < 2 || [...temiz].length > 16) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(temiz)) return null;
  return temiz;
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

    if (url.pathname === "/eslestir" && istek.method === "GET") {
      if (kaynak && !izinliKaynak(kaynak)) return new Response("İzin yok", { status: 403 });
      return env.ESLESTIRME.get(env.ESLESTIRME.idFromName("tum")).fetch(istek);
    }

    if (url.pathname === "/yonetim" && istek.method === "GET") {
      return new Response(YONETIM_SAYFASI, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } });
    }
    if (url.pathname.startsWith("/yonetim/") && istek.method === "POST") {
      if (!yetkiliMi(istek, env)) return new Response(JSON.stringify({ hata: "Yetkisiz" }), { status: 401 });
      if (url.pathname === "/yonetim/liste") return Response.json(await oyuncular.yonetimListesi());
      if (url.pathname === "/yonetim/islem") {
        const { islem, hedef } = await istek.json();
        if (islem === "ad-sifirla") await oyuncular.adSifirla(hedef);
        else if (islem === "yasakla") await oyuncular.yasakla(hedef, true);
        else if (islem === "yasak-kaldir") await oyuncular.yasakla(hedef, false);
        else if (islem === "kapat") await oyuncular.sikayetleriKapat(hedef);
        else return Response.json({ hata: "Bilinmeyen işlem" }, { status: 400 });
        return Response.json({ tamam: true });
      }
    }

    if (istek.method !== "POST") return cevap({ ad: "Harfoni sunucusu" }, kaynak);

    if (url.pathname === "/duello") {
      const { mod, bot, puansiz } = await istek.json().catch(() => ({}));
      const kod = await odaAc(env, { mod, bot, puansiz: Boolean(puansiz) });
      return kod ? cevap({ kod }, kaynak) : cevap({ hata: "Oda açılamadı, tekrar dene" }, kaynak, 500);
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
      if (kabaMi(ad)) return cevap({ hata: "Bu ad kullanılamaz, başka bir ad seç" }, kaynak, 400);
      const oyuncu = await oyuncular.kaydet(id, ozet, ad);
      return oyuncu ? cevap(oyuncu, kaynak) : cevap({ hata: "Kimlik doğrulanamadı" }, kaynak, 403);
    }
    if (url.pathname === "/oyuncu/bilgi") {
      const oyuncu = await oyuncular.dogrula(id, ozet);
      return oyuncu ? cevap(oyuncu, kaynak) : cevap({ hata: "Oyuncu bulunamadı" }, kaynak, 404);
    }
    if (url.pathname === "/giris") {
      const kimlik = await jetonuDogrula(govde.saglayici, govde.jeton);
      if (!kimlik) return cevap({ hata: "Giriş doğrulanamadı, tekrar dene" }, kaynak, 401);
      // Başka bir profile giriş yapılırsa bu cihaz için yeni anahtar üretilir.
      const yeniAnahtar = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      // Apple: bağı sonradan kaldırabilmek için yenileme jetonu al.
      const ek = {};
      if (govde.saglayici === "apple" && govde.kod) {
        ek.istemci = govde.istemci === "com.harfoni.app" ? "com.harfoni.app" : "com.harfoni.web";
        ek.yenileme = await yenilemeJetonuAl(env, ek.istemci, govde.kod);
      }
      const sonuc = await oyuncular.hesapGirisi(govde.saglayici, kimlik.sub, id, ozet, await anahtarOzeti(yeniAnahtar), ek);
      if (!sonuc) return cevap({ hata: "Bu hesaba bağlı bir profil yok. Önce takma adını seç, sonra profilinden bağla." }, kaynak, 404);
      const yeniKimlik = sonuc.yeniCihaz ? { id: sonuc.id, anahtar: yeniAnahtar } : { id, anahtar };
      const profil = await oyuncular.dogrula(yeniKimlik.id, await anahtarOzeti(yeniKimlik.anahtar));
      return cevap({ kimlik: sonuc.yeniCihaz ? yeniKimlik : null, profil }, kaynak);
    }
    if (url.pathname === "/giris/kaldir") {
      const jetonlar = await oyuncular.hesapBaginiKaldir(id, ozet, govde.saglayici);
      for (const j of jetonlar || []) await bagiKaldir(env, j.istemci, j.yenileme);
      return cevap({ tamam: Boolean(jetonlar) }, kaynak);
    }
    if (url.pathname === "/oyuncu/engeller") {
      const liste = await oyuncular.engeller(id, ozet);
      return liste ? cevap(liste, kaynak) : cevap({ hata: "Oyuncu bulunamadı" }, kaynak, 404);
    }
    if (url.pathname === "/oyuncu/engel-kaldir") {
      return cevap({ tamam: await oyuncular.engelKaldir(id, ozet, Number(govde.no)) }, kaynak);
    }
    if (url.pathname === "/oyuncu/sil") {
      const jetonlar = await oyuncular.sil(id, ozet);
      for (const j of jetonlar || []) await bagiKaldir(env, j.istemci, j.yenileme);
      return cevap({ silindi: Boolean(jetonlar) }, kaynak);
    }
    return cevap({ hata: "Bulunamadı" }, kaynak, 404);
  },
};
