// Seferdeki bir bulmacanın ekranı. Klasik kuralıyla (4–6 harf), bir boss
// kuralıyla (Şahmeran, Cin, Karakoncolos) ya da Arada olarak oynanır.
// Bulmaca durumu (b) sefer kaydının parçası: burada değiştirilir, kaydet() ile saklanır.

import { GECERLI, YALIN } from "../kelimeler.js";
import { GECERLI4, GECERLI6 } from "./sozluk.js";
import { degerlendir } from "../ortak/degerlendir.js";
import { buyuk, karsilastir, HARFLER } from "../ortak/turkce.js";
import { bildir } from "../ortak/arayuz.js";
import { zar, karistir } from "./zar.js";
import { KURALLAR } from "./veri.js";
import { tasHesapla } from "./puan.js";

const GECERLILER = { 4: GECERLI4, 5: GECERLI, 6: GECERLI6 };
const CEVIRME_ARASI = 220; // ms, harflerin sırayla dönmesi
const DURUMLAR = ["dogru", "var", "yok"];
// Şahmeran'da yalan denen karenin gerçek rengi görünen dışındaki iki renkten biridir;
// klavyede bu iki ihtimal tuşun iki yarısına boyanır (Palavra'daki gibi).
const YALANIN_GERCEGI = { yok: "dogru-var", dogru: "var-yok", var: "dogru-yok" };
const NOT_SIRASI = [undefined, "dogru", "var", "yok"];
// Kahve Falı ve Sünger'in griye boyadığı harfler sık kullanılanlardan seçilir.
const SIK_HARFLER = "aeinrlıkdmyutsboüşzgçh";
const TEBRIK = ["Şans mı bu?", "İnanılmaz!", "Dâhiyane!", "Muhteşem!", "Harika!", "Güzel!", "Kıl payı!", "Son anda!"];
export const BOSS_TURLERI = new Set(["miniboss", "bekci"]);

// Kelimede olmayan, henüz denenmemiş ve griye boyanmamış harflerden birkaçı.
export function yokHarfSec(b, adet, tohum, etiket) {
  const denenmis = new Set(b.tahminler.join(""));
  const adaylar = [...SIK_HARFLER].filter((h) => !b.cevap.includes(h) && !b.gri.includes(h) && !denenmis.has(h));
  return karistir(zar(tohum, etiket, b.dugum, b.deneme, b.gri.length), adaylar).slice(0, adet);
}

// Fener'in açacağı yer: henüz yeşil olmamış ve açılmamış bir kare. Yoksa null.
export function fenerYeriSec(b, tohum) {
  const bilinen = new Set(b.fener);
  for (const t of b.tahminler) {
    degerlendir(t, b.cevap).forEach((d, j) => {
      if (d === "dogru") bilinen.add(j);
    });
  }
  const adaylar = [...b.cevap].map((_, j) => j).filter((j) => !bilinen.has(j));
  if (!adaylar.length) return null;
  const r = zar(tohum, "fener", b.dugum, b.deneme, b.fener.length);
  return adaylar[Math.floor(r() * adaylar.length)];
}

// Arada'nın sözlüğü (yalın 5 harfli kelimeler, Türkçe alfabe sırasında), ilk kullanımda kurulur.
let aradaSozlugu;
function aradaSozluguAl() {
  if (!aradaSozlugu) {
    const liste = ["aaaaa", ...[...YALIN].sort(karsilastir), "zzzzz"];
    aradaSozlugu = { liste, sira: new Map(liste.map((k, i) => [k, i])) };
  }
  return aradaSozlugu;
}

function ortakBaslangic(a, b) {
  let n = 0;
  while (n < a.length && a[n] === b[n]) n++;
  return n;
}

function basliklar(b) {
  const kural = b.kural ? KURALLAR[b.kural] : null;
  let baslik = b.arada ? "Arada" : b.tur === "zorlu" ? "Zorlu bulmaca" : "Bulmaca";
  const parcalar = [`${b.uzunluk} harf`, `<span class="hak-yazisi">${b.hak}</span> hak`];
  if (BOSS_TURLERI.has(b.tur)) {
    baslik = `${kural.simge} ${kural.ad}`;
    parcalar.unshift(b.tur === "bekci" ? "Ada bekçisi" : "Mini boss");
  }
  if (b.esik) parcalar.push(`en az ${b.esik} puan`);
  if (b.deneme) parcalar.push(`${b.deneme + 1}. deneme`);
  return { baslik, alt: parcalar.join(" · "), kural };
}

/**
 * kap       : ekran kabı
 * klavye    : klavyeKur'un döndürdüğü nesne (sefer boyunca tek klavye)
 * b         : bulmaca durumu
 * tilsimlar : () => sahip olunan tılsımlar
 * kaydet    : sefer kaydı
 * bitince   : ({ cozuldu, kacis }) => void
 * tilsimSalla: (id) => void, tetiklenen tılsımı gösterir
 * Döner: { tus, iksirEngeli, iksirUygula }
 */
export function bulmacaAc({ kap, klavye, b, tohum, tilsimlar, kaydet, bitince, tilsimSalla }) {
  const sahip = (id) => tilsimlar().includes(id);
  const etkinKural = () => (b.acik || b.gozDamlasi ? null : b.kural);
  let mevcut = "";
  let kilitli = false;
  let sonTas = null;

  const { baslik, alt, kural } = basliklar(b);
  kap.innerHTML = `
    <div class="bulmaca-ust">
      <div class="bulmaca-baslik"><strong>${baslik}</strong><span>${alt}</span></div>
      <div class="sayaclar">
        <div class="sayac tas"><span>Taş</span><strong id="tas-sayaci">0</strong></div>
        <div class="sayac carpan"><span>Çarpan</span><strong id="carpan-sayaci">×1</strong></div>
      </div>
    </div>
    ${kural ? `<p class="kural-metni" id="kural-metni">${kural.simge} ${kural.aciklama}</p>` : ""}
    <div class="tahta-alani">
      ${
        b.arada
          ? `<div class="a-arada">
              <div class="hak-satiri"><div id="a-hak" class="hak-noktalari"></div><span class="hak-sayisi"><strong id="a-kalan"></strong> hak</span></div>
              <div id="a-ust" class="satir kelime-satiri" aria-label="Üst sınır"></div>
              <div class="arada-ok" aria-hidden="true">↓</div>
              <div id="a-giris" class="satir kelime-satiri giris-satiri" aria-label="Tahminin"></div>
              <div class="arada-ok" aria-hidden="true">↑</div>
              <div id="a-alt" class="satir kelime-satiri" aria-label="Alt sınır"></div>
              <div id="a-harfler" class="uygun-harfler" aria-label="Sıradaki harf için uygun harfler"></div>
            </div>`
          : `<div id="a-tahta" class="a-tahta" aria-label="Tahminler"></div>`
      }
    </div>`;

  const tasEl = kap.querySelector("#tas-sayaci");
  const carpanEl = kap.querySelector("#carpan-sayaci");
  const tahta = kap.querySelector("#a-tahta");

  // ---- Sayaçlar ----
  // Boss kuralı varken taş gizli: görünen renklerle gerçek taş farklı olabilir,
  // sayaç kuralın sakladığını ele verirdi. Bulmaca çözülünce açılır.
  function sayaclariGuncelle(animasyonlu) {
    const gizli = Boolean(etkinKural());
    const tas = tasHesapla(b, tilsimlar());
    tasEl.textContent = gizli ? "?" : tas.toplam;
    // Çarpan: bir sonraki tahminde bulursan 1 + kalan hak.
    const kalan = Math.max(0, b.hak - b.tahminler.length - (b.bitti ? 0 : 1));
    carpanEl.textContent = `×${1 + kalan}`;
    if (animasyonlu && !gizli && sonTas) {
      const fark = tas.toplam - sonTas.toplam;
      if (fark > 0) artisGoster(`+${fark}`);
      for (const e of tas.ekler) {
        const onceki = sonTas.ekler.find((x) => x.id === e.id)?.deger || 0;
        if (e.deger > onceki) tilsimSalla(e.id);
      }
    }
    if (!gizli) sonTas = tas;
  }

  function artisGoster(metin) {
    const el = document.createElement("span");
    el.className = "tas-artis";
    el.textContent = metin;
    tasEl.parentElement.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function basligiGuncelle() {
    for (const el of kap.querySelectorAll(".hak-yazisi")) el.textContent = b.hak;
    kap.querySelector("#kural-metni")?.classList.toggle("kalkti", Boolean(b.gozDamlasi));
  }

  // ---- Klasik tahta ----
  function satirOlustur() {
    const satir = document.createElement("div");
    satir.className = "satir a-satir";
    for (let h = 0; h < b.uzunluk; h++) {
      const kare = document.createElement("div");
      kare.className = "kare";
      satir.appendChild(kare);
    }
    const sayilar = document.createElement("div");
    sayilar.className = "sayilar";
    satir.appendChild(sayilar);
    return satir;
  }

  function tahtaKur() {
    const sayili = etkinKural() === "cin";
    tahta.innerHTML = "";
    tahta.classList.toggle("sayili", sayili);
    tahta.style.setProperty("--uzunluk", b.uzunluk);
    tahta.style.setProperty("--sutun", b.uzunluk + (sayili ? 1.4 : 0));
    tahta.style.setProperty("--satir-sayisi", b.hak);
    for (let s = 0; s < b.hak; s++) tahta.appendChild(satirOlustur());
    b.tahminler.forEach((_, i) => satiriBoya(i, false));
    mevcutSatiriCiz();
    klavyeyiBoya();
  }

  // Bir satırın oyuncuya görünen hali. Kural yoksa ya da kelime bulunduysa gerçek renkler.
  function gorunen(i) {
    const tahmin = b.tahminler[i];
    const gercek = degerlendir(tahmin, b.cevap);
    const kural = etkinKural();
    if (!kural || tahmin === b.cevap) return { renkler: gercek };
    if (kural === "cin") return { renkler: gercek, sayili: true };
    const r = zar(tohum, "kural", b.dugum, b.deneme, i);
    const yer = Math.floor(r() * gercek.length);
    if (kural === "karakoncolos") return { renkler: gercek, sis: yer };
    const renkler = [...gercek];
    const digerleri = DURUMLAR.filter((d) => d !== gercek[yer]);
    renkler[yer] = digerleri[Math.floor(r() * digerleri.length)];
    return { renkler, yalan: yer };
  }

  // Dedektif tılsımı Şahmeran'ın ilk satırdaki yalanını gösterir.
  const dedektifYeri = (i, g) => (i === 0 && g.yalan !== undefined && sahip("dedektif") ? g.yalan : -1);

  function satiriBoya(i, animasyonlu) {
    const tahmin = b.tahminler[i];
    const g = gorunen(i);
    const satir = tahta.children[i];
    const kesinYalan = dedektifYeri(i, g);
    const sahmeran = etkinKural() === "sahmeran";
    [...satir.children].slice(0, b.uzunluk).forEach((kare, h) => {
      kare.textContent = buyuk(tahmin[h]);
      kare.classList.remove("fener-ipucu", "dolu");
      const boya = () => {
        for (const ad of ["durum", "acik", "sis", "isaret", "kesin"]) delete kare.dataset[ad];
        const not = b.notlar[`${i}-${h}`];
        if (g.sayili) {
          kare.dataset.acik = "";
          if (not) kare.dataset.isaret = not;
        } else if (g.sis === h) {
          kare.dataset.sis = "";
        } else {
          kare.dataset.durum = g.renkler[h];
        }
        kare.classList.toggle("yalan-isareti", sahmeran && (h === kesinYalan || not === "yalan"));
        if (h === kesinYalan) kare.dataset.kesin = "";
      };
      if (animasyonlu) {
        kare.style.animationDelay = `${h * CEVIRME_ARASI}ms`;
        kare.classList.remove("donuyor");
        void kare.offsetWidth; // animasyonu yeniden başlatmak için
        kare.classList.add("donuyor");
        setTimeout(boya, h * CEVIRME_ARASI + 250);
      } else {
        boya();
      }
    });
    const sayilar = satir.querySelector(".sayilar");
    if (g.sayili) {
      const adet = { dogru: 0, var: 0, yok: 0 };
      for (const d of g.renkler) adet[d] += 1;
      const goster = () => {
        sayilar.innerHTML = DURUMLAR.map((d) => `<span data-durum="${d}">${adet[d]}</span>`).join("");
        sayilar.classList.add("gorunur");
      };
      if (animasyonlu) setTimeout(goster, b.uzunluk * CEVIRME_ARASI + 100);
      else goster();
    } else {
      sayilar.innerHTML = "";
      sayilar.classList.remove("gorunur");
    }
    const sure = animasyonlu ? (b.uzunluk - 1) * CEVIRME_ARASI + 520 : 0;
    return new Promise((tamam) => setTimeout(tamam, sure));
  }

  function mevcutSatiriCiz() {
    const satir = tahta.children[b.tahminler.length];
    if (!satir || b.bitti) return;
    [...satir.children].slice(0, b.uzunluk).forEach((kare, h) => {
      const harf = mevcut[h] || "";
      const ipucu = !harf && b.fener.includes(h);
      kare.textContent = harf ? buyuk(harf) : ipucu ? buyuk(b.cevap[h]) : "";
      kare.classList.toggle("dolu", Boolean(harf));
      kare.classList.toggle("fener-ipucu", ipucu);
    });
  }

  function klavyeyiBoya() {
    klavye.temizle();
    if (b.arada) return;
    for (const h of b.gri) klavye.boya(h, "yok");
    for (const yer of b.fener) klavye.boya(b.cevap[yer], "dogru");
    const sahmeran = etkinKural() === "sahmeran";
    b.tahminler.forEach((t, i) => {
      const g = gorunen(i);
      const kesinYalan = dedektifYeri(i, g);
      for (let h = 0; h < b.uzunluk; h++) {
        const not = b.notlar[`${i}-${h}`];
        if (g.sayili) {
          if (not) klavye.boya(t[h], not);
        } else if (g.sis !== h) {
          const yalan = sahmeran && (h === kesinYalan || not === "yalan");
          klavye.boya(t[h], yalan ? YALANIN_GERCEGI[g.renkler[h]] : g.renkler[h]);
        }
      }
    });
  }

  // Şahmeran'da yalan dediğin kareyi, Cin'de kendi notlarını işaretlersin.
  tahta?.addEventListener("click", (e) => {
    const kural = etkinKural();
    if (b.bitti || (kural !== "cin" && kural !== "sahmeran")) return;
    const kare = e.target.closest(".kare");
    if (!kare) return;
    const satir = kare.parentElement;
    const i = [...tahta.children].indexOf(satir);
    const h = [...satir.children].indexOf(kare);
    if (i < 0 || i >= b.tahminler.length || h >= b.uzunluk) return;
    const anahtar = `${i}-${h}`;
    if (kural === "cin") {
      const sonraki = NOT_SIRASI[(NOT_SIRASI.indexOf(b.notlar[anahtar]) + 1) % NOT_SIRASI.length];
      if (sonraki) b.notlar[anahtar] = sonraki;
      else delete b.notlar[anahtar];
    } else {
      if (dedektifYeri(i, gorunen(i)) >= 0 || b.tahminler[i] === b.cevap) return;
      const vardi = b.notlar[anahtar] === "yalan";
      for (let j = 0; j < b.uzunluk; j++) delete b.notlar[`${i}-${j}`]; // satırda tek yalan
      if (!vardi) b.notlar[anahtar] = "yalan";
    }
    satiriBoya(i, false);
    klavyeyiBoya();
    kaydet();
  });

  // ---- Arada ----
  const ustEl = kap.querySelector("#a-ust");
  const altEl = kap.querySelector("#a-alt");
  const girisEl = kap.querySelector("#a-giris");
  const harflerEl = kap.querySelector("#a-harfler");

  function aradaKur() {
    for (const el of [ustEl, altEl, girisEl]) {
      el.innerHTML = '<div class="kare"></div>'.repeat(b.uzunluk);
    }
    harflerEl.innerHTML = [...HARFLER].map((h) => `<span class="uygun-harf" data-harf="${h}">${buyuk(h)}</span>`).join("");
    aradaCiz();
  }

  function aradaSinirlari() {
    const { liste, sira } = aradaSozluguAl();
    const hedef = sira.get(b.cevap);
    let ust = 0;
    let alt = liste.length - 1;
    for (const t of b.tahminler) {
      const s = sira.get(t);
      if (s < hedef) ust = Math.max(ust, s);
      else if (s > hedef) alt = Math.min(alt, s);
    }
    return { ust, alt, liste };
  }

  function sinirCiz(el, kelime, bilinen, animasyonlu) {
    [...el.children].forEach((kare, h) => {
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

  function aradaCiz(degisen) {
    const { ust, alt, liste } = aradaSinirlari();
    const bilinen = ortakBaslangic(liste[ust], liste[alt]);
    sinirCiz(ustEl, liste[ust], bilinen, degisen === "ust");
    sinirCiz(altEl, liste[alt], bilinen, degisen === "alt");
    const kalan = b.hak - b.tahminler.length;
    kap.querySelector("#a-kalan").textContent = kalan;
    const noktalar = kap.querySelector("#a-hak");
    noktalar.innerHTML = Array.from({ length: b.hak }, (_, i) => `<span${i >= kalan ? ' class="kullanildi"' : ""}></span>`).join("");
    girisCiz();
  }

  function girisCiz() {
    const gosterilen = b.bitti ? b.cevap : mevcut;
    [...girisEl.children].forEach((kare, h) => {
      const harf = gosterilen[h] || "";
      kare.textContent = buyuk(harf);
      kare.classList.toggle("dolu", Boolean(harf));
      if (b.bitti) kare.dataset.durum = b.cozuldu ? "dogru" : "var";
      else delete kare.dataset.durum;
    });
    // Sıradaki harf için sınırların arasında kalan harfler parlar.
    const { ust, alt, liste } = aradaSinirlari();
    const sira = mevcut.length;
    const ustBas = liste[ust].slice(0, sira + 1);
    const altBas = liste[alt].slice(0, sira + 1);
    for (const el of harflerEl.children) {
      const aday = mevcut + el.dataset.harf;
      const uygun = !b.bitti && sira < b.uzunluk && karsilastir(aday, ustBas) >= 0 && karsilastir(aday, altBas) <= 0;
      el.classList.toggle("uygun", uygun);
    }
  }

  // ---- Tahmin ----
  function salla() {
    const satir = b.arada ? girisEl : tahta.children[b.tahminler.length];
    satir.classList.remove("salla");
    void satir.offsetWidth;
    satir.classList.add("salla");
  }

  function tus(t) {
    if (b.bitti || kilitli) return;
    if (t === "gir") return b.arada ? aradaGonder() : gonder();
    if (t === "sil") {
      mevcut = mevcut.slice(0, -1);
    } else if (mevcut.length < b.uzunluk) {
      mevcut += t;
      const satir = b.arada ? girisEl : tahta.children[b.tahminler.length];
      const kare = satir.children[mevcut.length - 1];
      kare.classList.remove("zipla");
      void kare.offsetWidth;
      kare.classList.add("zipla");
    }
    if (b.arada) girisCiz();
    else mevcutSatiriCiz();
  }

  async function gonder() {
    if (mevcut.length < b.uzunluk) {
      salla();
      return bildir("Harf sayısı yetersiz");
    }
    if (!GECERLILER[b.uzunluk].has(mevcut)) {
      salla();
      return bildir("Sözlükte yok");
    }
    const tahmin = mevcut;
    mevcut = "";
    b.tahminler.push(tahmin);
    kilitli = true;
    kaydet();
    await satiriBoya(b.tahminler.length - 1, true);
    klavyeyiBoya();
    if (tahmin === b.cevap) return bitir(true);
    sayaclariGuncelle(true);
    if (b.tahminler.length >= b.hak) return bitir(false);
    kilitli = false;
    mevcutSatiriCiz();
  }

  function aradaGonder() {
    if (mevcut.length < b.uzunluk) {
      salla();
      return bildir("Harf sayısı yetersiz");
    }
    if (!YALIN.has(mevcut)) {
      salla();
      return bildir(GECERLI.has(mevcut) ? "Arada'da sadece eksiz kelimeler geçer" : "Sözlükte yok");
    }
    const { sira } = aradaSozluguAl();
    const { ust, alt } = aradaSinirlari();
    const yer = sira.get(mevcut);
    if (yer <= ust || yer >= alt) {
      salla();
      return bildir("Bu kelime aralığın dışında");
    }
    const tahmin = mevcut;
    mevcut = "";
    b.tahminler.push(tahmin);
    kaydet();
    const hedef = sira.get(b.cevap);
    if (tahmin === b.cevap) {
      aradaCiz();
      return bitir(true);
    }
    aradaCiz(yer < hedef ? "ust" : "alt");
    sayaclariGuncelle(true);
    bildir(yer < hedef ? "Daha sonra ↓" : "Daha önce ↑", 900);
    if (b.tahminler.length >= b.hak) bitir(false);
  }

  function bitir(cozuldu) {
    b.bitti = true;
    b.cozuldu = cozuldu;
    kilitli = true;
    if (cozuldu) {
      const kuralVardi = Boolean(etkinKural());
      b.acik = true; // bulununca bütün kareler gerçek renkleriyle görünür
      if (kuralVardi && !b.arada) {
        tahtaKur();
        tahta.classList.add("acildi");
        bildir("Gerçek renkler açıldı", 1400);
      }
      sayaclariGuncelle(true);
      const satir = b.arada ? girisEl : tahta.children[b.tahminler.length - 1];
      satir.classList.add("kazandi");
      bildir(TEBRIK[b.tahminler.length - 1] || "Buldun!");
    } else {
      if (b.arada) girisCiz();
      bildir(buyuk(b.cevap), 2800);
    }
    kaydet();
    setTimeout(() => bitince({ cozuldu }), cozuldu ? 1500 : 2300);
  }

  // ---- İksirler ----
  function iksirEngeli(id) {
    if (b.bitti || kilitli) return "Şu an kullanılamaz";
    switch (id) {
      case "fener":
        if (b.arada) return "Arada'da işe yaramaz";
        return fenerYeriSec(b, tohum) === null ? "Açılacak harf kalmadı" : null;
      case "sunger":
        if (b.arada) return "Arada'da işe yaramaz";
        return yokHarfSec(b, 4, tohum, "sunger").length ? null : "Boyanacak harf kalmadı";
      case "kurabiye":
        return b.kurabiye ? "Bu bulmacada zaten kullandın" : null;
      case "gozdamlasi":
        return etkinKural() ? null : "Bu bulmacada kaldırılacak bir kural yok";
      case "kacis":
        return BOSS_TURLERI.has(b.tur) ? "Boss'tan kaçılmaz" : null;
      default:
        return null;
    }
  }

  function iksirUygula(id) {
    if (id === "fener") {
      b.fener.push(fenerYeriSec(b, tohum));
      mevcutSatiriCiz();
      klavyeyiBoya();
      bildir("🔦 Bir harf açıldı");
    } else if (id === "sunger") {
      const harfler = yokHarfSec(b, 4, tohum, "sunger");
      b.gri.push(...harfler);
      klavyeyiBoya();
      bildir(`🧽 ${harfler.map(buyuk).join(", ")} kelimede yok`, 2200);
    } else if (id === "kumsaati") {
      b.hak += 1;
      if (b.arada) {
        aradaCiz();
      } else {
        tahta.style.setProperty("--satir-sayisi", b.hak);
        tahta.appendChild(satirOlustur());
      }
      bildir("⏳ +1 hak");
    } else if (id === "kurabiye") {
      b.kurabiye = true;
      bildir("🥠 Bu bulmacada taşlar ×2");
    } else if (id === "gozdamlasi") {
      b.gozDamlasi = true;
      tahtaKur();
      bildir("💧 Kural kalktı");
    } else if (id === "kacis") {
      b.bitti = true;
      b.kacti = true;
      kilitli = true;
      kaydet();
      bitince({ kacis: true });
      return;
    }
    basligiGuncelle();
    sayaclariGuncelle(false);
    kaydet();
  }

  if (b.arada) {
    klavye.temizle(); // Arada'da klavye boyanmaz; önceki bulmacanın renkleri kalmasın
    aradaKur();
  } else {
    tahtaKur();
  }
  basligiGuncelle();
  sayaclariGuncelle(false);

  return { tus, iksirEngeli, iksirUygula };
}
