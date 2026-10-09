// Google ve Apple ile giriş düğmeleri. Web sitesinde Google'ın ve Apple'ın
// web kodları (sadece gerekince yüklenir), uygulamalarda telefonun kendi giriş
// ekranı (SocialLogin eklentisi) kullanılır.
//
// Hangi yerde hangi giriş var:
//   web sitesi: Google, Apple   iPhone: Apple, Google   Android: Google

const GOOGLE_WEB_ISTEMCI = "658158319640-0qvddsgfujedsivtrp2gdg5bo3mjao5d.apps.googleusercontent.com";
const GOOGLE_IOS_ISTEMCI = "658158319640-i6ac6hvfb9a6mbg5qlgsijj6475e5b3p.apps.googleusercontent.com";

const capacitor = window.Capacitor;
const uygulamada = Boolean(capacitor?.isNativePlatform?.());
const platform = uygulamada ? capacitor.getPlatform() : "web";
const webGirisVar = !uygulamada;

export const girisSaglayicilari = platform === "ios" ? ["apple", "google"] : platform === "android" ? ["google"] : ["google", "apple"];

let yukleniyor = null;

function googleYukle() {
  if (!yukleniyor) {
    yukleniyor = new Promise((tamam, hata) => {
      const betik = document.createElement("script");
      betik.src = "https://accounts.google.com/gsi/client";
      betik.async = true;
      betik.onload = tamam;
      betik.onerror = () => {
        yukleniyor = null;
        hata(new Error("Google'a bağlanılamadı"));
      };
      document.head.appendChild(betik);
    });
  }
  return yukleniyor;
}

let sonGeriCagirma = null;

// kap içine Google düğmesi çizer; giriş olunca geriCagir(jeton) çağrılır.
async function googleDugmesi(kap, geriCagir) {
  if (!webGirisVar) return;
  await googleYukle();
  sonGeriCagirma = geriCagir;
  window.google.accounts.id.initialize({
    client_id: GOOGLE_WEB_ISTEMCI,
    callback: (yanit) => sonGeriCagirma?.(yanit.credential),
    ux_mode: "popup",
    auto_select: false,
    use_fedcm_for_button: true,
  });
  kap.innerHTML = "";
  const karanlik = matchMedia("(prefers-color-scheme: dark)").matches;
  window.google.accounts.id.renderButton(kap, {
    type: "standard",
    theme: karanlik ? "filled_black" : "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    locale: "tr",
    width: 260,
  });
}

// ---------- Apple ----------

const APPLE_WEB_ISTEMCI = "com.harfoni.web";
let appleYukleniyor = null;

function appleYukle() {
  if (!appleYukleniyor) {
    appleYukleniyor = new Promise((tamam, hata) => {
      const betik = document.createElement("script");
      betik.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js";
      betik.onload = () => {
        window.AppleID.auth.init({
          clientId: APPLE_WEB_ISTEMCI,
          scope: "", // ad ve e-posta istemiyoruz
          redirectURI: "https://harfoni.com/duello.html",
          usePopup: true,
        });
        tamam();
      };
      betik.onerror = () => {
        appleYukleniyor = null;
        hata(new Error("Apple'a bağlanılamadı"));
      };
      document.head.appendChild(betik);
    });
  }
  return appleYukleniyor;
}

// kap içine "Apple ile devam et" düğmesi koyar; giriş olunca
// geriCagir({ jeton, kod, istemci }) çağrılır.
const APPLE_LOGOSU =
  '<svg viewBox="0 0 17 20" width="15" height="18" aria-hidden="true"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8s2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.2.7-3 1.6-.6.7-1.2 1.9-1 3 1.1.1 2.3-.6 3-1.4z"/></svg>';
const GOOGLE_LOGOSU =
  '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';

function appleDugmesi(kap, geriCagir) {
  if (!webGirisVar) return;
  kap.innerHTML = "";
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "apple-dugmesi";
  dugme.innerHTML = `${APPLE_LOGOSU} Apple ile devam et`;
  dugme.addEventListener("click", async () => {
    try {
      await appleYukle();
      const yanit = await window.AppleID.auth.signIn();
      geriCagir({ jeton: yanit.authorization.id_token, kod: yanit.authorization.code, istemci: APPLE_WEB_ISTEMCI });
    } catch (hata) {
      // Kullanıcı pencereyi kapattıysa sessiz geç.
      if (hata?.error !== "popup_closed_by_user" && hata?.error !== "user_cancelled_authorize") console.log("Apple girişi:", hata);
    }
  });
  kap.appendChild(dugme);
}

// ---------- Uygulama içinde (telefonun kendi giriş ekranı) ----------

let yerelBaslatma = null;

function yerelBaslat() {
  if (!yerelBaslatma) {
    yerelBaslatma = capacitor.Plugins.SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_ISTEMCI, iOSClientId: GOOGLE_IOS_ISTEMCI, iOSServerClientId: GOOGLE_WEB_ISTEMCI, mode: "online" },
      ...(platform === "ios" ? { apple: { clientId: "com.harfoni.app", useProperTokenExchange: true } } : {}),
    });
  }
  return yerelBaslatma;
}

function yerelDugme(saglayici, kap, geriCagir) {
  kap.innerHTML = "";
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = saglayici === "apple" ? "apple-dugmesi" : "google-dugmesi";
  dugme.innerHTML = saglayici === "apple" ? `${APPLE_LOGOSU} Apple ile devam et` : `${GOOGLE_LOGOSU} Google ile devam et`;
  dugme.addEventListener("click", async () => {
    try {
      await yerelBaslat();
      const { result } = await capacitor.Plugins.SocialLogin.login({
        provider: saglayici,
        options: saglayici === "apple" ? { scopes: [] } : {},
      });
      if (!result?.idToken) return;
      geriCagir(
        saglayici === "apple"
          ? { jeton: result.idToken, kod: result.authorizationCode, istemci: "com.harfoni.app" }
          : { jeton: result.idToken }
      );
    } catch (hata) {
      // Kullanıcı vazgeçtiyse sessiz geç.
      console.log("Giriş yapılmadı:", hata?.message || hata);
    }
  });
  kap.appendChild(dugme);
}

// kap içine o sağlayıcının düğmesini koyar; giriş olunca geriCagir({ jeton, kod?, istemci? }).
export async function girisDugmesi(saglayici, kap, geriCagir) {
  if (!girisSaglayicilari.includes(saglayici)) return;
  if (uygulamada) return yerelDugme(saglayici, kap, geriCagir);
  if (saglayici === "google") return googleDugmesi(kap, (jeton) => geriCagir({ jeton }));
  return appleDugmesi(kap, geriCagir);
}
