// Google ve Apple ile giriş düğmeleri (sadece web sitesinde; uygulamalarda
// telefonun kendi giriş ekranı kullanılacak). Kodları sadece gerekince yüklenir.

const GOOGLE_WEB_ISTEMCI = "658158319640-0qvddsgfujedsivtrp2gdg5bo3mjao5d.apps.googleusercontent.com";

export const webGirisVar = !window.Capacitor;

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
export async function googleDugmesi(kap, geriCagir) {
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
export function appleDugmesi(kap, geriCagir) {
  if (!webGirisVar) return;
  kap.innerHTML = "";
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "apple-dugmesi";
  dugme.innerHTML =
    '<svg viewBox="0 0 17 20" width="15" height="18" aria-hidden="true"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8s2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.2.7-3 1.6-.6.7-1.2 1.9-1 3 1.1.1 2.3-.6 3-1.4z"/></svg> Apple ile devam et';
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
