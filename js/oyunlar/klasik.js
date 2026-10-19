import { tahminOyunuKur } from "../ortak/tahmin-oyunu.js";
import { degerlendir } from "../ortak/degerlendir.js";
import { siralamaKur, gunlukSonucuGonder } from "../ortak/siralama.js";

siralamaKur();

tahminOyunuKur({
  oyun: "klasik",
  ad: "Klasik",
  hak: 6,
  tebrik: ["Dâhiyane!", "Muhteşem!", "Harika!", "Çok iyi!", "Güzel!", "Kıl payı!"],
  renkler: (tahmin, cevap) => degerlendir(tahmin, cevap),
  bitince: gunlukSonucuGonder,
});
