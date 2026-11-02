// Sadece mağaza uygulamasının içinde (Capacitor) çalışan özellikler.
// Tarayıcıda hiçbir şey yapmaz.

(() => {
  const capacitor = window.Capacitor;
  const uygulamada = Boolean(capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform());

  if (uygulamada) {
    document.documentElement.classList.add("uygulama");
    gunlukHatirlatmayiKur();
    geriTusunuKur();
  }

  // Android'de geri tuşu / kenardan kaydırma: önce açık pencereyi kapat,
  // sonra bir önceki sayfaya dön, ana sayfadaysak uygulamayı arka plana al.
  // Sayfalar "harfoni:geri" olayını iptal ederek kendileri karşılayabilir
  // (ör. Düello'da maçtan çıkarken sormak için).
  function geriTusunuKur() {
    const { App } = capacitor.Plugins;
    if (!App) return;
    App.addListener("backButton", ({ canGoBack }) => {
      const pencere = [...document.querySelectorAll("dialog[open]")].pop();
      if (pencere) return pencere.close();
      if (!dispatchEvent(new Event("harfoni:geri", { cancelable: true }))) return;
      const anaSayfada = /\/(index\.html)?$/.test(location.pathname);
      if (anaSayfada) App.minimizeApp();
      else if (canGoBack) history.back();
      else location.href = "index.html";
    });
  }

  // "Bugünün bulmacaları hazır" bildirimi: oyuncu açarsa her gün seçtiği saatte.
  function gunlukHatirlatmayiKur() {
    const kutu = document.getElementById("hatirlatma");
    if (!kutu) return;
    const { LocalNotifications } = capacitor.Plugins;
    const BILDIRIM = 1;
    const ANAHTAR = "harfoni.hatirlatma";

    const anahtarDugme = document.getElementById("hatirlatma-ac");
    const saatSecimi = document.getElementById("hatirlatma-saat");
    for (let saat = 6; saat <= 23; saat++) {
      const secenek = document.createElement("option");
      secenek.value = saat;
      secenek.textContent = `${String(saat).padStart(2, "0")}.00`;
      saatSecimi.appendChild(secenek);
    }

    let ayar = { acik: false, saat: 9 };
    try {
      ayar = { ...ayar, ...JSON.parse(localStorage.getItem(ANAHTAR) || "{}") };
    } catch {}
    anahtarDugme.checked = ayar.acik;
    saatSecimi.value = ayar.saat;
    saatSecimi.disabled = !ayar.acik;
    kutu.hidden = false;

    async function uygula() {
      await LocalNotifications.cancel({ notifications: [{ id: BILDIRIM }] });
      if (ayar.acik) {
        const izin = await LocalNotifications.requestPermissions();
        if (izin.display !== "granted") {
          ayar.acik = false;
          anahtarDugme.checked = false;
          alert("Bildirimlere izin verilmedi. iPhone Ayarlar → Harfoni → Bildirimler'den açabilirsin.");
        } else {
          await LocalNotifications.schedule({
            notifications: [{
              id: BILDIRIM,
              title: "Harfoni",
              body: "Bugünün bulmacaları hazır! Serini bozma.",
              schedule: { on: { hour: Number(ayar.saat), minute: 0 }, allowWhileIdle: true },
            }],
          });
        }
      }
      saatSecimi.disabled = !ayar.acik;
      try {
        localStorage.setItem(ANAHTAR, JSON.stringify(ayar));
      } catch {}
    }

    anahtarDugme.addEventListener("change", () => {
      ayar.acik = anahtarDugme.checked;
      uygula();
    });
    saatSecimi.addEventListener("change", () => {
      ayar.saat = Number(saatSecimi.value);
      uygula();
    });
  }
})();
