// Google ve Apple ile giriş: telefondan gelen kimlik jetonunu (ID token, JWT)
// doğrular ve kullanıcının o hizmetteki değişmez numarasını (sub) döner.
// E-posta ya da isim okunmaz, saklanmaz.

const SAGLAYICILAR = {
  google: {
    anahtarlar: "https://www.googleapis.com/oauth2/v3/certs",
    yayincilar: ["accounts.google.com", "https://accounts.google.com"],
    // Web, iOS ve Android uygulamalarının istemci kimlikleri (gizli değil).
    kitle: [
      "658158319640-i6ac6hvfb9a6mbg5qlgsijj6475e5b3p.apps.googleusercontent.com",
      "658158319640-0qvddsgfujedsivtrp2gdg5bo3mjao5d.apps.googleusercontent.com",
    ],
  },
  apple: {
    anahtarlar: "https://appleid.apple.com/auth/keys",
    yayincilar: ["https://appleid.apple.com"],
    kitle: ["com.harfoni.app", "com.harfoni.web"],
  },
};

const onbellek = {}; // sağlayıcı -> { zaman, anahtarlar }

async function acikAnahtarlar(saglayici) {
  const kayit = onbellek[saglayici];
  if (kayit && Date.now() - kayit.zaman < 60 * 60 * 1000) return kayit.anahtarlar;
  const yanit = await fetch(SAGLAYICILAR[saglayici].anahtarlar);
  const { keys } = await yanit.json();
  onbellek[saglayici] = { zaman: Date.now(), anahtarlar: keys };
  return keys;
}

function base64url(metin) {
  const b64 = metin.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(metin.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const jsonCoz = (parca) => JSON.parse(new TextDecoder().decode(base64url(parca)));

// Geçerliyse { sub } döner, değilse null.
export async function jetonuDogrula(saglayici, jeton) {
  const ayar = SAGLAYICILAR[saglayici];
  if (!ayar || typeof jeton !== "string") return null;
  const parcalar = jeton.split(".");
  if (parcalar.length !== 3) return null;
  let baslik, icerik;
  try {
    baslik = jsonCoz(parcalar[0]);
    icerik = jsonCoz(parcalar[1]);
  } catch {
    return null;
  }
  if (baslik.alg !== "RS256") return null;

  let jwk = (await acikAnahtarlar(saglayici)).find((k) => k.kid === baslik.kid);
  if (!jwk) {
    delete onbellek[saglayici]; // anahtarlar yenilenmiş olabilir
    jwk = (await acikAnahtarlar(saglayici)).find((k) => k.kid === baslik.kid);
    if (!jwk) return null;
  }
  const anahtar = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const gecerli = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    anahtar,
    base64url(parcalar[2]),
    new TextEncoder().encode(`${parcalar[0]}.${parcalar[1]}`)
  );
  if (!gecerli) return null;

  const simdi = Date.now() / 1000;
  if (!ayar.yayincilar.includes(icerik.iss)) return null;
  const kitleler = Array.isArray(icerik.aud) ? icerik.aud : [icerik.aud];
  if (!kitleler.some((k) => ayar.kitle.includes(k))) return null;
  if (typeof icerik.exp !== "number" || icerik.exp < simdi - 60) return null;
  if (typeof icerik.sub !== "string" || !icerik.sub) return null;
  return { sub: icerik.sub };
}
