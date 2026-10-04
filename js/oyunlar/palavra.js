import { tahminOyunuKur } from "../ortak/tahmin-oyunu.js";
import { degerlendir } from "../ortak/degerlendir.js";
import { rastgeleUretec } from "../ortak/rastgele.js";
import { kucuk } from "../ortak/turkce.js";
import { isaretTemizleyiciKur } from "../ortak/isaretler.js";

const DURUMLAR = ["dogru", "var", "yok"];

// Klasik değerlendirme, ama her satırda tam bir kare yalan söyler:
// gerçek rengi yerine diğer iki renkten biri gösterilir. Hangi karenin
// yalan söyleyeceği gün ve satıra göre belirlenir, tahmine göre değil.
// Kelime bulununca yalan yok, satır olduğu gibi gösterilir.
function palavraRenkleri(tahmin, cevap, satirNo, tohum) {
  const gercek = degerlendir(tahmin, cevap);
  if (tahmin === cevap) return gercek;

  const rastgele = rastgeleUretec(tohum * 1000 + satirNo);
  const yer = Math.floor(rastgele() * gercek.length);
  const digerleri = DURUMLAR.filter((d) => d !== gercek[yer]);
  const sonuc = [...gercek];
  sonuc[yer] = digerleri[Math.floor(rastgele() * digerleri.length)];
  return sonuc;
}

const oyun = tahminOyunuKur({
  oyun: "palavra",
  ad: "Palavra",
  hak: 8,
  tebrik: [
    "İnanılmaz!", "Dâhiyane!", "Muhteşem!", "Harika!",
    "Çok iyi!", "Güzel!", "Az kalsın!", "Kıl payı!",
  ],
  renkler: palavraRenkleri,
});

// Oyuncu yalan olduğunu düşündüğü kareye dokunup işaretleyebilir.
// Satırda tek bir kare işaretlenebilir; işaretler kaydedilir.
oyun.tahta.addEventListener("click", (e) => {
  const kare = e.target.closest(".kare");
  if (!kare || !kare.dataset.durum) return;
  const satir = kare.parentElement;
  if (satir.classList.contains("kazandi")) return;
  const satirNo = [...oyun.tahta.children].indexOf(satir);
  const harfNo = [...satir.children].indexOf(kare);

  const isaretli = satir.querySelector(".kare.yalan-isareti");
  if (isaretli && isaretli !== kare) {
    isaretli.classList.remove("yalan-isareti");
    oyun.notlar.yaz(satirNo, [...satir.children].indexOf(isaretli), null);
  }
  const yeniDurum = kare.classList.toggle("yalan-isareti");
  oyun.notlar.yaz(satirNo, harfNo, yeniDurum ? "yalan" : null);
  klavyeyiBoya();
  temizleyiciyiGuncelle();
});

// Kayıtlı işaretleri geri yükle.
for (const anahtar of Object.keys(oyun.notlar.hepsi())) {
  const [satirNo, harfNo] = anahtar.split("-").map(Number);
  oyun.tahta.children[satirNo]?.children[harfNo]?.classList.add("yalan-isareti");
}

// Yalan denen karenin gerçek rengi, görünen dışındaki iki renkten biridir.
// Klavyede bu iki ihtimal tuşun iki yarısına boyanır.
const YALANIN_GERCEGI = { yok: "dogru-var", dogru: "var-yok", var: "dogru-yok" };

// Klavye karelerde görünen renklerle boyanır; oyuncunun yalan dediği kareler
// iki ihtimalli olarak boyanır. Kesin renkler ihtimallilerin önüne geçer.
function klavyeyiBoya() {
  oyun.klavye.temizle();
  for (const kare of oyun.tahta.querySelectorAll(".kare[data-durum]")) {
    const harf = kucuk(kare.textContent);
    const durum = kare.dataset.durum;
    const yalan = kare.classList.contains("yalan-isareti");
    oyun.klavye.boya(harf, yalan ? YALANIN_GERCEGI[durum] : durum);
  }
}
klavyeyiBoya();

const temizleyiciyiGuncelle = isaretTemizleyiciKur(oyun, () => {
  for (const kare of oyun.tahta.querySelectorAll(".kare.yalan-isareti")) kare.classList.remove("yalan-isareti");
  klavyeyiBoya();
});
