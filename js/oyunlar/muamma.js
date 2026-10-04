import { tahminOyunuKur } from "../ortak/tahmin-oyunu.js";
import { kucuk } from "../ortak/turkce.js";
import { isaretTemizleyiciKur } from "../ortak/isaretler.js";

// Muamma: hangi harflerin doğru olduğu söylenmez, sadece kaç tanesinin
// doğru yerde, yanlış yerde ya da kelimede yok olduğu söylenir.
const oyun = tahminOyunuKur({
  oyun: "muamma",
  ad: "Muamma",
  hak: 8,
  tebrik: [
    "İnanılmaz!", "Dâhiyane!", "Muhteşem!", "Harika!",
    "Çok iyi!", "Güzel!", "Az kalsın!", "Kıl payı!",
  ],
  sayiIpucu: true,
  emoji: { yok: "🟥" },
});

// Oyuncu karelere dokunarak kendi notlarını alır:
// boş → doğru yerde → başka yerde → yok → boş. Notlar kaydedilir.
const SIRA = [undefined, "dogru", "var", "yok"];

oyun.tahta.addEventListener("click", (e) => {
  const kare = e.target.closest(".kare");
  if (!kare || !("acik" in kare.dataset)) return;
  const satir = kare.parentElement;
  const simdiki = SIRA.indexOf(kare.dataset.isaret);
  const sonraki = SIRA[(simdiki + 1) % SIRA.length];
  if (sonraki) kare.dataset.isaret = sonraki;
  else delete kare.dataset.isaret;
  oyun.notlar.yaz(
    [...oyun.tahta.children].indexOf(satir),
    [...satir.children].indexOf(kare),
    sonraki
  );
  klavyeyiIsaretlereGoreBoya();
  temizleyiciyiGuncelle();
});

// Bir harf herhangi bir karede "doğru yerde" işaretliyse klavyede de öyle
// görünür; yoksa "başka yerde", o da yoksa "yok".
function klavyeyiIsaretlereGoreBoya() {
  oyun.klavye.temizle();
  for (const kare of oyun.tahta.querySelectorAll(".kare[data-isaret]")) {
    oyun.klavye.boya(kucuk(kare.textContent), kare.dataset.isaret);
  }
}

// Kayıtlı notları geri yükle.
for (const [anahtar, deger] of Object.entries(oyun.notlar.hepsi())) {
  const [satirNo, harfNo] = anahtar.split("-").map(Number);
  const kare = oyun.tahta.children[satirNo]?.children[harfNo];
  if (kare && "acik" in kare.dataset) kare.dataset.isaret = deger;
}
klavyeyiIsaretlereGoreBoya();

const temizleyiciyiGuncelle = isaretTemizleyiciKur(oyun, () => {
  for (const kare of oyun.tahta.querySelectorAll(".kare[data-isaret]")) delete kare.dataset.isaret;
  klavyeyiIsaretlereGoreBoya();
});
