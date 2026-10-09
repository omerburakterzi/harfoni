// Harf tablosuna dayalı oyunların (Klasik, Palavra) ortak altyapısı:
// tahta, klavye, günlük kayıt ve paylaşım metni. Oyunlar sadece kurallarını verir.

import { CEVAPLAR, GECERLI } from "../kelimeler.js";
import { buyuk } from "./turkce.js";
import { gununKelimesi } from "./gunluk.js";
import { oku, yaz } from "./depo.js";
import { sonucKaydet } from "./istatistik.js";
import { klavyeKur } from "./klavye.js";
import { bildir } from "./arayuz.js";
import { sayfaKur } from "./sayfa.js";
import { degerlendir } from "./degerlendir.js";

const UZUNLUK = 5;
const CEVIRME_ARASI = 280; // ms, harflerin sırayla dönmesi
const EMOJI = { dogru: "🟦", var: "🟧", yok: "⬛" };

function sayiOzeti(renkler) {
  const adet = { dogru: 0, var: 0, yok: 0 };
  for (const d of renkler) adet[d] += 1;
  return adet;
}

/**
 * ayarlar:
 *   oyun        : kayıt anahtarı ("klasik", "palavra")
 *   ad          : paylaşımda görünen ad ("Klasik")
 *   hak         : tahmin hakkı
 *   tebrik      : her tahmin sayısı için kazanma mesajı (hak uzunluğunda)
 *   renkler     : (tahmin, cevap, satirNo, tohum) => ["dogru" | "var" | "yok", ...]
 *   klavyeBoya  : tuşlar renklensin mi (varsayılan true)
 *   emoji       : paylaşım emojilerini değiştirmek için, ör. { yok: "🟥" }
 *   sayiIpucu   : kareler renklenmez, satırın yanında sadece kaç harfin
 *                 doğru / yanlış yerde / yok olduğu yazar (Muamma)
 */
export function tahminOyunuKur(ayarlar) {
  const { oyun, ad, hak, tebrik, sayiIpucu = false } = ayarlar;
  const renkler = ayarlar.renkler || ((tahmin, cevap) => degerlendir(tahmin, cevap));
  const klavyeBoya = ayarlar.klavyeBoya ?? !sayiIpucu;
  const emoji = { ...EMOJI, ...ayarlar.emoji };

  let cevap;
  let tohum; // oyuna özel rastgelelik (günlükte herkes için aynı)
  let tahminler = [];
  let notlar = {}; // oyuncunun karelere aldığı notlar: { "satır-harf": değer }
  let mevcut = "";
  let bitti = false;
  let kazandi = false;
  let kilitli = false;

  const sayfa = sayfaKur({ oyun, hak, tebrik, yeniOyun: baslat, paylasimMetni });
  const { alistirma, gun } = sayfa;

  const tahta = document.getElementById("tahta");
  const klavye = klavyeKur(document.getElementById("klavye"), tusaBasildi);

  function tahtaKur() {
    tahta.innerHTML = "";
    tahta.style.setProperty("--satir-sayisi", hak);
    tahta.classList.toggle("sayili", sayiIpucu);
    for (let s = 0; s < hak; s++) {
      const satir = document.createElement("div");
      satir.className = "satir";
      for (let h = 0; h < UZUNLUK; h++) {
        const kare = document.createElement("div");
        kare.className = "kare";
        satir.appendChild(kare);
      }
      if (sayiIpucu) {
        const sayilar = document.createElement("div");
        sayilar.className = "sayilar";
        satir.appendChild(sayilar);
      }
      tahta.appendChild(satir);
    }
  }

  const satirEl = (i) => tahta.children[i];
  const satirRenkleri = (tahmin, i) => renkler(tahmin, cevap, i, tohum);

  function mevcutSatiriCiz() {
    const kareler = satirEl(tahminler.length).children;
    for (let h = 0; h < UZUNLUK; h++) {
      const harf = mevcut[h] || "";
      kareler[h].textContent = buyuk(harf);
      kareler[h].classList.toggle("dolu", Boolean(harf));
    }
  }

  function satiriBoya(i, tahmin, animasyonlu) {
    const sonuc = satirRenkleri(tahmin, i);
    const kareler = satirEl(i).children;
    const bulundu = tahmin === cevap;
    sonuc.forEach((durum, h) => {
      const kare = kareler[h];
      kare.textContent = buyuk(tahmin[h]);
      const boya = () => {
        if (sayiIpucu && !bulundu) kare.dataset.acik = "";
        else kare.dataset.durum = durum;
        if (klavyeBoya) klavye.boya(tahmin[h], durum);
      };
      if (animasyonlu) {
        kare.style.animationDelay = `${h * CEVIRME_ARASI}ms`;
        kare.classList.add("donuyor");
        setTimeout(boya, h * CEVIRME_ARASI + 250);
      } else {
        boya();
      }
    });
    if (sayiIpucu) {
      const sayilar = satirEl(i).querySelector(".sayilar");
      const goster = () => {
        const adet = sayiOzeti(sonuc);
        sayilar.innerHTML = ["dogru", "var", "yok"]
          .map((d) => `<span data-durum="${d}">${adet[d]}</span>`)
          .join("");
        sayilar.classList.add("gorunur");
      };
      if (animasyonlu) setTimeout(goster, UZUNLUK * CEVIRME_ARASI + 100);
      else goster();
    }
    const sure = animasyonlu ? (UZUNLUK - 1) * CEVIRME_ARASI + 500 : 0;
    return new Promise((bitince) => setTimeout(bitince, sure));
  }

  function salla() {
    const satir = satirEl(tahminler.length);
    satir.classList.remove("salla");
    void satir.offsetWidth; // animasyonu yeniden başlatmak için
    satir.classList.add("salla");
  }

  function tusaBasildi(tus) {
    if (bitti || kilitli) return;
    if (tus === "gir") return gonder();
    if (tus === "sil") {
      mevcut = mevcut.slice(0, -1);
    } else if (mevcut.length < UZUNLUK) {
      mevcut += tus;
      const kare = satirEl(tahminler.length).children[mevcut.length - 1];
      kare.classList.remove("zipla");
      void kare.offsetWidth;
      kare.classList.add("zipla");
    }
    mevcutSatiriCiz();
  }

  async function gonder() {
    if (mevcut.length < UZUNLUK) {
      salla();
      return bildir("Harf sayısı yetersiz");
    }
    if (!GECERLI.has(mevcut)) {
      salla();
      return bildir("Sözlükte yok");
    }

    const tahmin = mevcut;
    const satir = tahminler.length;
    mevcut = "";
    tahminler.push(tahmin);
    kilitli = true;
    await satiriBoya(satir, tahmin, true);
    kilitli = false;

    if (tahmin === cevap) {
      bitir(true);
    } else if (tahminler.length === hak) {
      bitir(false);
    }
    kaydet();
  }

  function bitir(sonuc) {
    bitti = true;
    kazandi = sonuc;
    if (kazandi) {
      satirEl(tahminler.length - 1).classList.add("kazandi");
      bildir(tebrik[tahminler.length - 1]);
    } else {
      bildir(buyuk(cevap), 3000);
    }
    if (!alistirma) sonucKaydet(oyun, hak, gun, kazandi, tahminler.length);
    sonucuGoster(1700);
  }

  function sonucuGoster(gecikme) {
    sayfa.sonucuGoster({ bitti, kazandi, tahminSayisi: tahminler.length, cevap }, gecikme);
  }

  function kaydet() {
    if (alistirma) return;
    yaz(`${oyun}.gunluk`, { gun, tahminler, bitti, kazandi, notlar });
  }

  function paylasimMetni() {
    // Paylaşım oyun bitince yapılır; Muamma'da da renkler gerçek yerlerinde
    // gösterilir (oyun sırasında gizli olan yerler artık sır değil).
    const satirlar = tahminler.map((t, i) => satirRenkleri(t, i).map((d) => emoji[d]).join(""));
    const skor = kazandi ? tahminler.length : "X";
    const adres = location.origin + location.pathname;
    return `Harfoni ${ad} #${gun} ${skor}/${hak}\n\n${satirlar.join("\n")}\n\n${adres}`;
  }

  function baslat() {
    tahtaKur();
    klavye.temizle();
    mevcut = "";
    bitti = false;
    kazandi = false;
    tahminler = [];
    notlar = {};

    if (alistirma) {
      cevap = CEVAPLAR[Math.floor(Math.random() * CEVAPLAR.length)];
      tohum = Math.floor(Math.random() * 1e9);
      return;
    }

    cevap = gununKelimesi(CEVAPLAR, gun, oyun);
    tohum = gun;
    const kayit = oku(`${oyun}.gunluk`, null);
    if (kayit && kayit.gun === gun) {
      tahminler = kayit.tahminler;
      tahminler.forEach((t, i) => satiriBoya(i, t, false));
      bitti = kayit.bitti;
      kazandi = kayit.kazandi;
      notlar = kayit.notlar || {};
      if (bitti) sonucuGoster(400);
    }
  }

  baslat();

  // Oyuna özel eklemeler (ör. Palavra'da kareleri işaretleme) için.
  return {
    tahta,
    klavye,
    // Oyuncu notları günlük kayıtla birlikte saklanır.
    notlar: {
      hepsi: () => notlar,
      yaz(satir, harf, deger) {
        const anahtar = `${satir}-${harf}`;
        if (deger) notlar[anahtar] = deger;
        else delete notlar[anahtar];
        kaydet();
      },
      temizle() {
        notlar = {};
        kaydet();
      },
    },
  };
}
