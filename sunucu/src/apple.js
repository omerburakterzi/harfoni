// Apple ile girişin sunucu tarafı: giriş kodunu yenileme jetonuna çevirme ve
// profil silinince Apple'daki bağı kaldırma (Apple bunu zorunlu tutuyor).
// İmza anahtarı (.p8) Cloudflare'de gizli ayar olarak durur: APPLE_ANAHTAR.

const TAKIM = "585MT2ALNC";
const ANAHTAR_NO = "S4P6U5YDBX";
export const APPLE_ISTEMCILER = ["com.harfoni.web", "com.harfoni.app"];

const b64url = (baytlar) =>
  btoa(String.fromCharCode(...new Uint8Array(baytlar))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const metinB64url = (metin) => b64url(new TextEncoder().encode(metin));

// Apple'a kendimizi tanıtan kısa ömürlü imzalı jeton (client_secret).
async function istemciSirri(env, istemci) {
  const pem = env.APPLE_ANAHTAR.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const anahtar = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const simdi = Math.floor(Date.now() / 1000);
  const baslik = metinB64url(JSON.stringify({ alg: "ES256", kid: ANAHTAR_NO }));
  const icerik = metinB64url(JSON.stringify({ iss: TAKIM, iat: simdi, exp: simdi + 300, aud: "https://appleid.apple.com", sub: istemci }));
  const imza = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, anahtar, new TextEncoder().encode(`${baslik}.${icerik}`));
  return `${baslik}.${icerik}.${b64url(imza)}`;
}

async function appleIstegi(env, yol, istemci, alanlar) {
  const govde = new URLSearchParams({ client_id: istemci, client_secret: await istemciSirri(env, istemci), ...alanlar });
  return fetch(`https://appleid.apple.com/auth/${yol}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: govde,
  });
}

// Girişte gelen tek kullanımlık kodu, sonradan bağı kaldırmak için gereken
// yenileme jetonuna çevirir. Olmazsa null (giriş yine de geçerli).
export async function yenilemeJetonuAl(env, istemci, kod) {
  if (!env.APPLE_ANAHTAR || !kod || !APPLE_ISTEMCILER.includes(istemci)) return null;
  try {
    const yanit = await appleIstegi(env, "token", istemci, { grant_type: "authorization_code", code: kod });
    if (!yanit.ok) return null;
    return (await yanit.json()).refresh_token || null;
  } catch {
    return null;
  }
}

export async function bagiKaldir(env, istemci, yenilemeJetonu) {
  if (!env.APPLE_ANAHTAR || !yenilemeJetonu) return;
  try {
    await appleIstegi(env, "revoke", istemci, { token: yenilemeJetonu, token_type_hint: "refresh_token" });
  } catch {
    // Apple'a ulaşılamadıysa profil yine de silinir.
  }
}
