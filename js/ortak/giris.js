// Google ile giriş düğmesi (sadece web sitesinde; uygulamalarda telefonun
// kendi giriş ekranı kullanılacak). Google'ın kodu sadece gerekince yüklenir.

const GOOGLE_WEB_ISTEMCI = "658158319640-i6ac6hvfb9a6mbg5qlgsijj6475e5b3p.apps.googleusercontent.com";

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
