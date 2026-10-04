// Arada: gizli kelime sözlükte (Türkçe alfabetik sırada) iki kelimenin arasında.
// Her tahmin aralığın bir ucunu yaklaştırır.

import { CEVAPLAR, GECERLI, YALIN } from "../kelimeler.js";
import { buyuk, karsilastir, HARFLER } from "../ortak/turkce.js";
import { gununKelimesi } from "../ortak/gunluk.js";
import { oku, yaz } from "../ortak/depo.js";
import { sonucKaydet } from "../ortak/istatistik.js";
import { klavyeKur } from "../ortak/klavye.js";
import { bildir } from "../ortak/arayuz.js";
import { sayfaKur } from "../ortak/sayfa.js";

const OYUN = "arada";
const HAK = 18;
const UZUNLUK = 5;
const TEBRIK = [
  "Şans mı bu?", "İnanılmaz!", "İnanılmaz!", "Dâhiyane!", "Dâhiyane!", "Muhteşem!",
  "Muhteşem!", "Harika!", "Harika!", "Çok iyi!", "Çok iyi!", "Güzel!",
  "Güzel!", "İyi!", "İyi!", "Fena değil!", "Az kalsın!", "Kıl payı!",
];

// Sözlük Türkçe alfabeye göre sıralı: C < Ç, G < Ğ, I < İ, O < Ö, S < Ş, U < Ü.
// Arada sadece yalın kelimeleri kullanır; ekli haller sözlüğü ikiye katlar ve
// aynı kökün halleri üst üste dizilir (ev, evde, evden...).
// Başta AAAAA, sonda ZZZZZ: oyun bu iki hayali sınırla başlar, tahmin edilemezler.
const SOZLUK = ["aaaaa", ...[...YALIN].sort(karsilastir), "zzzzz"];
const SIRA = new Map(SOZLUK.map((kelime, i) => [kelime, i]));

let cevap;
let tahminler = [];
let mevcut = "";
let ust; // aralığın üst ucu (sözlükteki sırası)
let alt; // aralığın alt ucu
let bitti = false;
let kazandi = false;

const sayfa = sayfaKur({ oyun: OYUN, hak: HAK, tebrik: TEBRIK, yeniOyun: baslat, paylasimMetni });
const { alistirma, gun } = sayfa;

const ustEl = document.getElementById("ust-sinir");
const altEl = document.getElementById("alt-sinir");
const girisEl = document.getElementById("giris");
klavyeKur(document.getElementById("klavye"), tusaBasildi);

function kareleriKur(kap) {
  kap.innerHTML = "";
  for (let h = 0; h < UZUNLUK; h++) {
    const kare = document.createElement("div");
    kare.className = "kare";
    kap.appendChild(kare);
  }
}

// İki ucun ortak başlangıcı gizli kelimenin de başlangıcıdır.
function ortakBaslangic(a, b) {
  let n = 0;
  while (n < a.length && a[n] === b[n]) n++;
  return n;
}

function sinirCiz(kap, kelime, bilinen, animasyonlu) {
  [...kap.children].forEach((kare, h) => {
    kare.textContent = buyuk(kelime[h]);
    if (h < bilinen) kare.dataset.durum = "dogru";
    else delete kare.dataset.durum;
    if (animasyonlu) {
      kare.classList.remove("donuyor");
      void kare.offsetWidth;
      kare.style.animationDelay = `${h * 60}ms`;
      kare.classList.add("donuyor");
    }
  });
}

function ekraniGuncelle(degisen) {
  const ustKelime = SOZLUK[ust];
  const altKelime = SOZLUK[alt];
  const bilinen = ortakBaslangic(ustKelime, altKelime);
  sinirCiz(ustEl, ustKelime, bilinen, degisen === "ust");
  sinirCiz(altEl, altKelime, bilinen, degisen === "alt");

  // Uzaklık: gizli kelime ile sınır arasında sözlüğün yüzde kaçı var.
  // Tahmin ettikçe sadece küçülür. İlk tahmine kadar gösterilmez.
  const hedef = SIRA.get(cevap);
  const toplam = SOZLUK.length - 1;
  const baslangic = tahminler.length === 0;
  document.getElementById("ust-yuzde").textContent = baslangic ? "?" : uzaklikYaz((hedef - ust) / toplam);
  document.getElementById("alt-yuzde").textContent = baslangic ? "?" : uzaklikYaz((alt - hedef) / toplam);
  // Soldaki işaret kelimenin kalan aralıktaki yerini gösterir: 0 = üstte, 1 = altta.
  const konum = (hedef - ust) / (alt - ust);
  const isaret = document.getElementById("olcek-isaret");
  isaret.hidden = baslangic;
  isaret.style.top = `${konum * 100}%`;
  document.getElementById("olcek-dolgu").style.height = baslangic ? "0" : `${konum * 100}%`;

  const kalanKelime = Math.max(0, alt - ust - 1);
  const elenen = 1 - kalanKelime / (SOZLUK.length - 2);
  const kalan = HAK - tahminler.length;
  document.getElementById("kalan-hak").textContent = kalan;
  const noktalar = document.getElementById("hak-noktalari");
  if (noktalar.children.length !== HAK) {
    noktalar.innerHTML = "";
    for (let i = 0; i < HAK; i++) noktalar.appendChild(document.createElement("span"));
  }
  [...noktalar.children].forEach((nokta, i) => nokta.classList.toggle("kullanildi", i >= kalan));
  document.getElementById("elenen").textContent = `%${Math.floor(elenen * 100)}`;
  document.getElementById("ilerleme").style.width = `${elenen * 100}%`;

  girisCiz();
}

function girisCiz() {
  const gosterilen = bitti ? cevap : mevcut;
  [...girisEl.children].forEach((kare, h) => {
    const harf = gosterilen[h] || "";
    kare.textContent = buyuk(harf);
    kare.classList.toggle("dolu", Boolean(harf));
    if (bitti && kazandi) kare.dataset.durum = "dogru";
    else if (bitti) kare.dataset.durum = "var";
    else delete kare.dataset.durum;
  });
  harfleriGuncelle();
}

// Uzaklığı okunaklı yazar: %16, %2,8, %0,94 gibi. Sıfıra hiç inmez.
function uzaklikYaz(oran) {
  const yuzde = oran * 100;
  const basamak = yuzde >= 10 ? 0 : yuzde >= 1 ? 1 : 2;
  const deger = Math.max(yuzde, 0.01);
  return "%" + deger.toLocaleString("tr-TR", { maximumFractionDigits: basamak });
}

// Sıradaki harf için sınırların arasında kalan harfleri parlatır.
// Örneğin sınırlar BLANK ve FAİRY ise ilk harf B, C, Ç, D, E ya da F olabilir;
// B yazınca ikinci harf L ya da sonrası olmalıdır.
function harfleriKur() {
  const kap = document.getElementById("uygun-harfler");
  kap.innerHTML = "";
  for (const harf of HARFLER) {
    const el = document.createElement("span");
    el.className = "uygun-harf";
    el.dataset.harf = harf;
    el.textContent = buyuk(harf);
    kap.appendChild(el);
  }
}

function harfleriGuncelle() {
  const sira = mevcut.length;
  const ustBas = SOZLUK[ust].slice(0, sira + 1);
  const altBas = SOZLUK[alt].slice(0, sira + 1);
  for (const el of document.querySelectorAll(".uygun-harf")) {
    const aday = mevcut + el.dataset.harf;
    const uygun =
      !bitti &&
      sira < UZUNLUK &&
      karsilastir(aday, ustBas) >= 0 &&
      karsilastir(aday, altBas) <= 0;
    el.classList.toggle("uygun", uygun);
  }
}

function salla() {
  girisEl.classList.remove("salla");
  void girisEl.offsetWidth;
  girisEl.classList.add("salla");
}

function tusaBasildi(tus) {
  if (bitti) return;
  if (tus === "gir") return gonder();
  if (tus === "sil") {
    mevcut = mevcut.slice(0, -1);
  } else if (mevcut.length < UZUNLUK) {
    mevcut += tus;
    const kare = girisEl.children[mevcut.length - 1];
    kare.classList.remove("zipla");
    void kare.offsetWidth;
    kare.classList.add("zipla");
  }
  girisCiz();
}

// Tahmini uygular; aralığın hangi ucunun değiştiğini döner.
function uygula(tahmin) {
  const sira = SIRA.get(tahmin);
  const hedef = SIRA.get(cevap);
  tahminler.push(tahmin);
  if (sira === hedef) return "bulundu";
  if (sira < hedef) {
    ust = sira;
    return "ust";
  }
  alt = sira;
  return "alt";
}

function gonder() {
  if (mevcut.length < UZUNLUK) {
    salla();
    return bildir("Harf sayısı yetersiz");
  }
  if (!YALIN.has(mevcut)) {
    salla();
    return bildir(GECERLI.has(mevcut) ? "Arada'da sadece eksiz kelimeler geçer" : "Sözlükte yok");
  }
  const sira = SIRA.get(mevcut);
  if (sira <= ust || sira >= alt) {
    salla();
    return bildir("Bu kelime aralığın dışında");
  }

  const tahmin = mevcut;
  mevcut = "";
  const degisen = uygula(tahmin);

  if (degisen === "bulundu") {
    bitir(true);
  } else {
    bildir(degisen === "ust" ? "Daha sonra ↓" : "Daha önce ↑", 900);
    if (tahminler.length === HAK) bitir(false);
  }
  ekraniGuncelle(degisen);
  kaydet();
}

function bitir(sonuc) {
  bitti = true;
  kazandi = sonuc;
  if (kazandi) {
    girisEl.classList.add("kazandi");
    bildir(TEBRIK[tahminler.length - 1]);
  } else {
    bildir(buyuk(cevap), 3000);
  }
  if (!alistirma) sonucKaydet(OYUN, HAK, gun, kazandi, tahminler.length);
  sayfa.sonucuGoster({ bitti, kazandi, tahminSayisi: tahminler.length, cevap }, 1700);
}

function kaydet() {
  if (alistirma) return;
  yaz(`${OYUN}.gunluk`, { gun, tahminler, bitti, kazandi });
}

function paylasimMetni() {
  const hedef = SIRA.get(cevap);
  const oklar = tahminler.map((t) => {
    const sira = SIRA.get(t);
    return sira === hedef ? "✅" : sira < hedef ? "⬇️" : "⬆️";
  });
  const skor = kazandi ? tahminler.length : "X";
  const adres = location.origin + location.pathname;
  return `Harfoni Arada #${gun} ${skor}/${HAK}\n\n${oklar.join("")}\n\n${adres}`;
}

function baslat() {
  harfleriKur();
  kareleriKur(ustEl);
  kareleriKur(altEl);
  kareleriKur(girisEl);
  girisEl.classList.remove("kazandi");
  tahminler = [];
  mevcut = "";
  bitti = false;
  kazandi = false;
  ust = 0;
  alt = SOZLUK.length - 1;

  cevap = alistirma
    ? CEVAPLAR[Math.floor(Math.random() * CEVAPLAR.length)]
    : gununKelimesi(CEVAPLAR, gun, OYUN);

  if (!alistirma) {
    const kayit = oku(`${OYUN}.gunluk`, null);
    if (kayit && kayit.gun === gun) {
      kayit.tahminler.forEach(uygula);
      bitti = kayit.bitti;
      kazandi = kayit.kazandi;
      if (bitti) sayfa.sonucuGoster({ bitti, kazandi, tahminSayisi: tahminler.length, cevap }, 400);
    }
  }
  ekraniGuncelle();
}

baslat();
