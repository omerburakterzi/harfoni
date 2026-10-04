// Palavra ve Muamma'da oyuncunun karelere aldığı notları tek dokunuşla silen düğme.
// Düğme sadece en az bir işaret varken görünür.
import { bildir } from "./arayuz.js";

export function isaretTemizleyiciKur(oyun, ekraniTemizle) {
  const dugme = document.getElementById("isaretleri-temizle");

  function guncelle() {
    dugme.hidden = Object.keys(oyun.notlar.hepsi()).length === 0;
  }

  dugme.addEventListener("click", () => {
    oyun.notlar.temizle();
    ekraniTemizle();
    guncelle();
    bildir("İşaretler temizlendi");
  });

  // Alıştırma modunda yeni kelimeye geçince işaretler sıfırlanır.
  document.getElementById("yeni-kelime")?.addEventListener("click", () => setTimeout(guncelle));

  guncelle();
  return guncelle;
}
