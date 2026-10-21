// Harf Adaları: seferin akışı. Menü → harita → düğüm (bulmaca, pazar, çeşme,
// sürpriz) → ödül → harita ... → ada bekçisi → sefer sonu.
// Sefer her adımda cihaza kaydedilir; sayfa kapanınca kaldığı yerden devam eder.

import { CEVAPLAR } from "../kelimeler.js";
import { CEVAP4, CEVAP6 } from "./sozluk.js";
import { klavyeKur } from "../ortak/klavye.js";
import { bildir, pencereAc, pencereleriBagla, paylas } from "../ortak/arayuz.js";
import { oku, yaz } from "../ortak/depo.js";
import { buyuk } from "../ortak/turkce.js";
import { bugununNumarasi, gununKelimesi } from "../ortak/gunluk.js";
import { zar, sec, agirlikliSec, karistir } from "./zar.js";
import { haritaKur, dugumBul, gidilebilenler, KATMAN_SAYISI } from "./harita.js";
import { puanHesapla, murekkepHesapla } from "./puan.js";
import { bulmacaAc, yokHarfSec, fenerYeriSec, BOSS_TURLERI } from "./bulmaca.js";
import {
  BASLANGIC, YUVA, HAK, ARADA_HAKKI, NADIRLIK, TILSIMLAR, IKSIRLER, KURALLAR, DUGUMLER,
  ODUL, PAZAR, OLAYLAR, tilsimFiyati, satisFiyati,
} from "./veri.js";

const KAYIT = "adalar.sefer";
const GECMIS = "adalar.gecmis";
const SURUM = 1;
const ADA_ADI = "Hece Kıyısı";
const KATMAN_ARASI = 74; // haritada katmanlar arası piksel
const SATIR_ARASI = 110; // ms, ödül dökümünde satırların belirme aralığı (css/adalar.css ile aynı)
const DAMLA = '<i class="damla" aria-hidden="true"></i>';

const ekran = document.getElementById("ekran");
const bilgiCubugu = document.getElementById("sefer-bilgi");
const klavyeKabi = document.getElementById("klavye");
const esyaPenceresi = document.getElementById("esya-penceresi");

let durum = oku(KAYIT, null);
if (durum && durum.surum !== SURUM) durum = null;
let menude = true;
let aktif = null; // açık bulmaca
const klavye = klavyeKur(klavyeKabi, (t) => aktif?.tus(t));

const sayi = (n) => n.toLocaleString("tr-TR");
const virgullu = (n) => String(n).replace(".", ",");
const sahip = (id) => durum.tilsimlar.includes(id);
const fiyat = (f) => Math.max(1, f - (sahip("simitci") ? 1 : 0));
const dakika = (ms) => `${Math.max(1, Math.round(ms / 60000))} dk`;

function kaydet() {
  if (!durum) return;
  // Süre sadece oynanırken işlesin: 3 dakikadan uzun aralar sayılmaz.
  const simdi = Date.now();
  const fark = simdi - (durum.sonHareket || simdi);
  if (fark > 0 && fark < 3 * 60 * 1000) durum.sure += fark;
  durum.sonHareket = simdi;
  yaz(KAYIT, durum);
}

// ---- Çizim ----
const EKRANLAR = {
  menu: menuCiz,
  harita: haritaCiz,
  bulmaca: bulmacaCiz,
  odul: odulCiz,
  secim: secimCiz,
  pazar: pazarCiz,
  cesme: cesmeCiz,
  surpriz: surprizCiz,
  son: sonCiz,
};

function ciz() {
  aktif = null;
  const ad = menude || !durum ? "menu" : durum.ekran;
  document.body.dataset.ekran = ad;
  klavyeKabi.hidden = ad !== "bulmaca";
  bilgiCubugu.hidden = ad === "menu";
  if (ad !== "menu") bilgiCiz();
  ekran.scrollTop = 0;
  EKRANLAR[ad]();
}

function bilgiCiz() {
  const canlar = Array.from({ length: durum.canSiniri }, (_, i) => (i < durum.can ? "❤️" : "🤍")).join("");
  const tilsimlar = Array.from({ length: YUVA.tilsim }, (_, i) => {
    const id = durum.tilsimlar[i];
    if (!id) return '<span class="yuva bos"></span>';
    const kullanildi = id === "nazar" && durum.nazarKullanildi ? " kullanildi" : "";
    return `<button class="yuva${kullanildi}" type="button" data-tilsim="${id}" aria-label="${TILSIMLAR[id].ad}">${TILSIMLAR[id].simge}</button>`;
  }).join("");
  const iksirler = Array.from({ length: YUVA.iksir }, (_, i) => {
    const id = durum.iksirler[i];
    if (!id) return '<span class="yuva bos"></span>';
    return `<button class="yuva" type="button" data-iksir="${i}" aria-label="${IKSIRLER[id].ad}">${IKSIRLER[id].simge}</button>`;
  }).join("");
  bilgiCubugu.innerHTML = `
    <div class="kaynaklar">
      <span class="can" aria-label="${durum.can} can">${canlar}</span>
      <span class="murekkep" aria-label="${durum.murekkep} mürekkep">${DAMLA}<strong>${durum.murekkep}</strong></span>
      <span class="toplam-puan" aria-label="${durum.puan} puan">⭐ <strong>${sayi(durum.puan)}</strong></span>
    </div>
    <div class="envanter">
      <div class="yuvalar" aria-label="Tılsımlar">${tilsimlar}</div>
      <div class="yuvalar iksirler" aria-label="İksirler">${iksirler}</div>
    </div>`;
}

function tilsimSalla(id) {
  const el = bilgiCubugu.querySelector(`[data-tilsim="${id}"]`);
  if (!el) return;
  el.classList.remove("tetiklendi");
  void el.offsetWidth;
  el.classList.add("tetiklendi");
}

bilgiCubugu.addEventListener("click", (e) => {
  const tilsim = e.target.closest("[data-tilsim]");
  if (tilsim) return tilsimPenceresi(tilsim.dataset.tilsim);
  const iksir = e.target.closest("[data-iksir]");
  if (iksir) iksirPenceresi(Number(iksir.dataset.iksir));
});

// ---- Pencereler ----
function pencereGoster(html, bagla) {
  const icerik = document.getElementById("esya-icerik");
  icerik.innerHTML = html;
  bagla?.(icerik);
  pencereAc("esya-penceresi");
}

function onayla(baslik, metin, evet, sonra) {
  pencereGoster(
    `<h2>${baslik}</h2><p>${metin}</p>
     <div class="pencere-dugmeleri"><button class="duz-dugme cerceveli" data-kapat>Vazgeç</button><button class="ana-dugme" id="evet">${evet}</button></div>`,
    (kap) =>
      kap.querySelector("#evet").addEventListener("click", () => {
        esyaPenceresi.close();
        sonra();
      })
  );
}

function esyaBasligi(simge, ad, alt) {
  return `<div class="esya-basligi"><span class="esya-simge">${simge}</span><div><h2>${ad}</h2><small>${alt}</small></div></div>`;
}

function tilsimPenceresi(id) {
  const t = TILSIMLAR[id];
  const satilabilir = durum.ekran !== "bulmaca";
  const notlar = [];
  if (id === "tespih") notlar.push(`Şu anki seri: +${durum.tespih} çarpan`);
  if (id === "nazar" && durum.nazarKullanildi) notlar.push("Bu adada kullanıldı.");
  pencereGoster(
    `${esyaBasligi(t.simge, t.ad, `<span class="nadirlik" data-nadirlik="${t.nadirlik}">${NADIRLIK[t.nadirlik].ad}</span> tılsım`)}
     <p>${t.aciklama}</p>
     ${notlar.map((n) => `<p class="soluk-yazi">${n}</p>`).join("")}
     ${
       satilabilir
         ? `<button class="duz-dugme cerceveli" id="sat">Sat: +${satisFiyati(id)} ${DAMLA}</button>`
         : '<p class="soluk-yazi">Bulmaca sırasında satılamaz.</p>'
     }`,
    (kap) =>
      kap.querySelector("#sat")?.addEventListener("click", () => {
        esyaPenceresi.close();
        tilsimSat(id);
        kaydet();
        bildir(`${t.ad} satıldı: +${satisFiyati(id)} mürekkep`);
        ciz();
      })
  );
}

function iksirPenceresi(sira) {
  const id = durum.iksirler[sira];
  const k = IKSIRLER[id];
  const bulmacada = durum.ekran === "bulmaca" && aktif;
  const engel = bulmacada ? aktif.iksirEngeli(id) : null;
  let alt = '<p class="soluk-yazi">İksirler bulmaca sırasında kullanılır.</p>';
  if (bulmacada) alt = engel ? `<p class="soluk-yazi">${engel}</p>` : '<button class="ana-dugme tam" id="kullan">Kullan</button>';
  pencereGoster(`${esyaBasligi(k.simge, k.ad, "İksir · tek kullanımlık")}<p>${k.aciklama}</p>${alt}`, (kap) =>
    kap.querySelector("#kullan")?.addEventListener("click", () => {
      esyaPenceresi.close();
      durum.iksirler.splice(sira, 1);
      bilgiCiz();
      aktif.iksirUygula(id);
    })
  );
}

// ---- Tılsım ve iksir alıp satma ----
function tilsimAl(id) {
  durum.tilsimlar.push(id);
  durum.alinan.push(id);
  if (id === "kirkyil") {
    durum.canSiniri = 4;
    durum.can = Math.min(durum.can + 1, 4);
  }
}

function tilsimSat(id) {
  durum.tilsimlar = durum.tilsimlar.filter((t) => t !== id);
  durum.murekkep += satisFiyati(id);
  if (id === "kirkyil") {
    durum.canSiniri = BASLANGIC.can;
    durum.can = Math.min(durum.can, BASLANGIC.can);
  }
  if (id === "tespih") durum.tespih = 0;
}

// Yuvalar doluysa önce hangi tılsımın satılacağı sorulur.
function tilsimEkle(id, sonra) {
  if (durum.tilsimlar.length < YUVA.tilsim) {
    tilsimAl(id);
    sonra();
    return;
  }
  const t = TILSIMLAR[id];
  pencereGoster(
    `<h2>Yuvaların dolu</h2>
     <p>${t.simge} ${t.ad} için yer aç: hangisini satacaksın?</p>
     <div class="yuva-listesi">${durum.tilsimlar
       .map((s) => `<button class="duz-dugme cerceveli" data-sat="${s}">${TILSIMLAR[s].simge} ${TILSIMLAR[s].ad} · +${satisFiyati(s)} ${DAMLA}</button>`)
       .join("")}</div>
     <button class="duz-dugme" data-kapat>Vazgeç</button>`,
    (kap) =>
      kap.querySelectorAll("[data-sat]").forEach((btn) =>
        btn.addEventListener("click", () => {
          esyaPenceresi.close();
          tilsimSat(btn.dataset.sat);
          tilsimAl(id);
          sonra();
        })
      )
  );
}

// Nadirliğe göre ağırlıklı, sahip olunmayan tılsımlardan seçer.
function tilsimSec(r, adet, nadirlikler = Object.keys(NADIRLIK)) {
  const secilen = [];
  for (let i = 0; i < adet; i++) {
    const havuz = Object.keys(TILSIMLAR).filter(
      (id) => !durum.tilsimlar.includes(id) && !secilen.includes(id) && nadirlikler.includes(TILSIMLAR[id].nadirlik)
    );
    if (!havuz.length) break;
    const agirliklar = {};
    for (const id of havuz) agirliklar[TILSIMLAR[id].nadirlik] = NADIRLIK[TILSIMLAR[id].nadirlik].agirlik;
    const nadirlik = agirlikliSec(r, agirliklar);
    secilen.push(sec(r, havuz.filter((id) => TILSIMLAR[id].nadirlik === nadirlik)));
  }
  return secilen;
}

function urunKarti(id, dugme, ek = "") {
  const t = TILSIMLAR[id];
  return `<div class="urun${ek}" data-nadirlik="${t.nadirlik}">
    <span class="urun-simge">${t.simge}</span>
    <strong>${t.ad}</strong>
    <small class="nadirlik" data-nadirlik="${t.nadirlik}">${NADIRLIK[t.nadirlik].ad}</small>
    <p>${t.aciklama}</p>
    ${dugme}
  </div>`;
}

// ---- Menü ----
function menuCiz() {
  const devam = durum && !durum.bitti;
  const gecmis = oku(GECMIS, []);
  const rekor = gecmis.reduce((a, s) => Math.max(a, s.puan), 0);
  ekran.innerHTML = `
    <section class="a-menu">
      <div class="a-logo" aria-hidden="true">🏝️</div>
      <h2>Harf Adaları</h2>
      <p class="a-slogan">Adadan adaya kelime bulmacaları çöz, tılsım topla, boss'ları yen. Her sefer farklı.</p>
      <div class="a-dugmeler">
        ${devam ? '<button class="ana-dugme" type="button" id="devam">Devam et</button>' : ""}
        <button class="${devam ? "duz-dugme cerceveli" : "ana-dugme"}" type="button" id="yeni">Yeni sefer</button>
        <button class="duz-dugme" type="button" id="nasil">Nasıl oynanır?</button>
      </div>
      ${devam ? `<p class="soluk-yazi">Yarım kalan sefer: ${katmanYazisi()} · ${sayi(durum.puan)} puan</p>` : ""}
      ${
        gecmis.length
          ? `<h3>Son seferlerin</h3>
             <ol class="gecmis-listesi">${gecmis
               .slice(0, 5)
               .map(
                 (s) => `<li><span>${s.kazandi ? "🏆" : "🌊"} ${s.kazandi ? "Ada geçildi" : `${s.katman}. katman`}</span><span>${dakika(s.sure * 60000)}</span><strong>${sayi(s.puan)}</strong></li>`
               )
               .join("")}</ol>
             <p class="soluk-yazi">En iyi: ${sayi(rekor)} puan · ${gecmis.length} sefer</p>`
          : ""
      }
      <p class="not">Deneme sürümü: şimdilik tek ada var, ${ADA_ADI}. Bir sefer 15–20 dakika sürer; ilerlemen her adımda kaydedilir.</p>
    </section>`;
  ekran.querySelector("#devam")?.addEventListener("click", () => {
    menude = false;
    ciz();
  });
  ekran.querySelector("#yeni").addEventListener("click", () => {
    if (devam) onayla("Yeni sefer", "Yarım kalan seferin silinecek.", "Yeni sefere başla", yeniSefer);
    else yeniSefer();
  });
  ekran.querySelector("#nasil").addEventListener("click", () => pencereAc("yardim-penceresi"));
}

function yeniSefer() {
  const tohum = Math.floor(Math.random() * 2 ** 31);
  durum = {
    surum: SURUM,
    tohum,
    can: BASLANGIC.can,
    canSiniri: BASLANGIC.can,
    murekkep: BASLANGIC.murekkep,
    puan: 0,
    tilsimlar: [],
    iksirler: [],
    harita: haritaKur(tohum),
    konum: null,
    hedef: null,
    gecilen: [],
    ekran: "harita",
    bulmaca: null,
    pazar: null,
    olay: null,
    odul: null,
    secim: null,
    kullanilan: [],
    tespih: 0,
    nazarKullanildi: false,
    bedavaFener: false,
    sonrakiKural: null,
    ist: { cozulen: 0, kaybedilen: 0, tahmin: 0, enIyi: 0 },
    alinan: [],
    sure: 0,
    sonHareket: Date.now(),
    baslangic: Date.now(),
    bitti: false,
    kazandi: false,
  };
  menude = false;
  kaydet();
  ciz();
}

// ---- Harita ----
function katmanYazisi() {
  const katman = durum.konum ? dugumBul(durum.harita, durum.konum).katman + 2 : 1;
  return `Katman ${Math.min(katman, KATMAN_SAYISI)}/${KATMAN_SAYISI}`;
}

function dugumTuru(d) {
  return d.arada ? "arada" : d.tur;
}

function dugumSimgesi(d) {
  if (d.arada) return DUGUMLER.arada.simge;
  if (d.tur === "bulmaca" || d.tur === "zorlu") return d.uzunluk;
  if (d.kural) return KURALLAR[d.kural].simge;
  return DUGUMLER[d.tur].simge;
}

function dugumEtiketi(d) {
  if (d.arada) return "Arada";
  if (d.tur === "bulmaca") return `${d.uzunluk} harf`;
  if (d.tur === "zorlu") return "Zorlu";
  if (d.tur === "miniboss") return KURALLAR[d.kural].ad;
  if (d.tur === "bekci") return `Bekçi · ${KURALLAR[d.kural].ad}`;
  return DUGUMLER[d.tur].ad;
}

function dugumAdi(d) {
  if (d.arada) return "Arada";
  if (d.tur === "bulmaca") return `Bulmaca · ${d.uzunluk} harf`;
  if (d.tur === "zorlu") return `Zorlu bulmaca · ${d.uzunluk} harf`;
  if (d.tur === "miniboss") return `Mini boss · ${KURALLAR[d.kural].ad}`;
  if (d.tur === "bekci") return `Ada bekçisi · ${KURALLAR[d.kural].ad}`;
  return DUGUMLER[d.tur].ad;
}

function hakSayisi(d) {
  if (d.arada) return ARADA_HAKKI;
  return HAK[d.uzunluk] + (d.uzunluk >= 6 && sahip("uzunsoluk") ? 1 : 0);
}

function dugumAciklamasi(d) {
  const k = d.kural ? KURALLAR[d.kural] : null;
  switch (d.tur) {
    case "bulmaca":
      if (d.arada) return `Gizli kelime alfabede iki kelimenin arasında, ${hakSayisi(d)} hak. Her tahmin 4 taş, bulan tahmin 50 taş.`;
      return `${d.uzunluk} harfli kelime, ${hakSayisi(d)} hak. Çözersen puan ve mürekkep kazanırsın; çözemezsen 1 can gider.`;
    case "zorlu":
      return `${d.uzunluk} harfli kelime, ${hakSayisi(d)} hak. Mürekkep ödülü ×1,5.`;
    case "miniboss":
      return `${k.aciklama} Ödül: ${ODUL.miniboss} mürekkep ve tılsım seçimi. Kaybedersen 1 can gider, yeni kelimeyle tekrar denersin.`;
    case "bekci":
      return `${k.aciklama} Ayrıca en az ${d.esik} puan gerekir. Geçersen ada tamamlanır.`;
    case "pazar":
      return "Tılsım ve iksir al. Tılsımlarını burada da satabilirsin.";
    case "cesme":
      return `1 can yenile ya da ${ODUL.cesme} mürekkep al.`;
    default:
      return "Ne çıkacağı belli değil: bir fırsat da olabilir, bir tuzak da.";
  }
}

function haritaCiz() {
  const gidilebilen = new Set(gidilebilenler(durum.harita, durum.konum));
  const dugumler = durum.harita.flat();
  const yukseklik = (KATMAN_SAYISI - 1) * KATMAN_ARASI + 84;
  const yerler = new Map(
    dugumler.map((d) => {
      const n = durum.harita[d.katman].length;
      const r = zar(durum.tohum, "konum", d.id);
      const x = ((d.sira + 1) / (n + 1)) * 100 + (n > 1 ? (r() - 0.5) * 10 : 0);
      const y = 40 + (KATMAN_SAYISI - 1 - d.katman) * KATMAN_ARASI + (r() - 0.5) * 10;
      return [d.id, { x, y }];
    })
  );

  let yollar = "";
  for (const d of dugumler) {
    for (const s of d.sonraki) {
      const a = yerler.get(d.id);
      const b = yerler.get(s);
      const sinif = durum.gecilen.includes(d.id) && durum.gecilen.includes(s) ? "gecildi" : d.id === durum.konum ? "acik" : "";
      yollar += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${sinif}"/>`;
    }
  }

  const dugumHtml = dugumler
    .map((d) => {
      const { x, y } = yerler.get(d.id);
      const siniflar = ["dugum"];
      if (durum.gecilen.includes(d.id)) siniflar.push("gecildi");
      if (gidilebilen.has(d.id)) siniflar.push("gidilebilir");
      if (d.id === durum.konum) siniflar.push("burada");
      return `<button class="${siniflar.join(" ")}" type="button" data-id="${d.id}" data-tur="${dugumTuru(d)}" style="left:${x}%;top:${y}px" aria-label="${dugumAdi(d)}">
        <span class="dugum-simge">${dugumSimgesi(d)}</span><span class="dugum-ad">${dugumEtiketi(d)}</span>
      </button>`;
    })
    .join("");

  ekran.innerHTML = `
    <section class="harita-ekrani">
      <div class="ada-basligi"><h2>${ADA_ADI}</h2><span>${katmanYazisi()}</span></div>
      <div class="harita" style="height:${yukseklik}px">
        <svg class="yollar" viewBox="0 0 100 ${yukseklik}" preserveAspectRatio="none" aria-hidden="true">${yollar}</svg>
        ${dugumHtml}
      </div>
      <div class="dugum-paneli" id="dugum-paneli"></div>
    </section>`;

  let secili = gidilebilen.size === 1 ? [...gidilebilen][0] : null;
  const panel = ekran.querySelector("#dugum-paneli");
  // Alttaki panel haritanın üstüne biner; seçilen durak panelin üstünde kalsın.
  function gorunurYap(id, davranis = "smooth") {
    const btn = ekran.querySelector(`.dugum[data-id="${id}"]`);
    if (!btn) return;
    const kutu = btn.getBoundingClientRect();
    const alt = panel.getBoundingClientRect().top - 10;
    const ust = ekran.getBoundingClientRect().top + 10;
    if (kutu.bottom > alt) ekran.scrollBy({ top: kutu.bottom - alt, behavior: davranis });
    else if (kutu.top < ust) ekran.scrollBy({ top: kutu.top - ust, behavior: davranis });
  }
  function panelCiz() {
    for (const btn of ekran.querySelectorAll(".dugum")) btn.classList.toggle("secili", btn.dataset.id === secili);
    if (!secili) {
      panel.innerHTML = '<p class="panel-ipucu">Parlayan duraklardan birine dokun.</p>';
      return;
    }
    const d = dugumBul(durum.harita, secili);
    let alt;
    if (gidilebilen.has(d.id)) alt = '<button class="ana-dugme tam" type="button" id="git">Git</button>';
    else if (durum.gecilen.includes(d.id)) alt = '<p class="soluk-yazi">Buradan geçtin.</p>';
    else alt = '<p class="soluk-yazi">Buraya şu an gidemezsin.</p>';
    panel.innerHTML = `
      <div class="panel-basligi"><span class="panel-simge" data-tur="${dugumTuru(d)}">${dugumSimgesi(d)}</span><strong>${dugumAdi(d)}</strong></div>
      <p>${dugumAciklamasi(d)}</p>${alt}`;
    panel.querySelector("#git")?.addEventListener("click", () => dugumeGir(d.id));
  }
  ekran.querySelector(".harita").addEventListener("click", (e) => {
    const btn = e.target.closest(".dugum");
    if (!btn) return;
    secili = btn.dataset.id;
    panelCiz();
    gorunurYap(secili);
  });
  panelCiz();
  gorunurYap(secili || [...gidilebilen][0], "auto");
}

function dugumeGir(id) {
  const d = dugumBul(durum.harita, id);
  durum.hedef = id;
  if (d.tur === "pazar") {
    durum.pazar = pazarHazirla(id, 0);
    durum.ekran = "pazar";
  } else if (d.tur === "cesme") {
    durum.ekran = "cesme";
  } else if (d.tur === "surpriz") {
    durum.olay = { tur: d.olay, adim: "secim" };
    durum.ekran = "surpriz";
  } else {
    durum.bulmaca = bulmacaHazirla(d, 0);
    durum.ekran = "bulmaca";
  }
  kaydet();
  ciz();
}

function dugumuBitir() {
  durum.konum = durum.hedef;
  if (!durum.gecilen.includes(durum.hedef)) durum.gecilen.push(durum.hedef);
  durum.hedef = null;
  durum.bulmaca = durum.pazar = durum.olay = durum.odul = durum.secim = null;
  durum.ekran = "harita";
  kaydet();
  ciz();
}

// ---- Bulmaca ----
// Seferde bugünün günlük kelimeleri çıkmasın.
let gunlukKelimeler;
function gunlukKelimeleri() {
  if (!gunlukKelimeler) {
    const gun = bugununNumarasi();
    gunlukKelimeler = new Set(["klasik", "palavra", "muamma", "arada"].map((o) => gununKelimesi(CEVAPLAR, gun, o)));
  }
  return gunlukKelimeler;
}

function kelimeSec(d, deneme) {
  const liste = d.uzunluk === 4 ? CEVAP4 : d.uzunluk === 6 ? CEVAP6 : CEVAPLAR;
  const yasak = new Set([...durum.kullanilan, ...gunlukKelimeleri()]);
  const r = zar(durum.tohum, "kelime", d.id, deneme);
  let i = Math.floor(r() * liste.length);
  while (yasak.has(liste[i])) i = (i + 1) % liste.length;
  durum.kullanilan.push(liste[i]);
  return liste[i];
}

function bulmacaHazirla(d, deneme) {
  let kural = d.kural || null;
  // Mürekkep Kuyusu'nun laneti sıradaki boss olmayan Klasik bulmacaya geçer.
  if (!kural && !d.arada && durum.sonrakiKural) {
    kural = durum.sonrakiKural;
    durum.sonrakiKural = null;
  }
  const b = {
    dugum: d.id,
    tur: d.tur,
    arada: Boolean(d.arada),
    uzunluk: d.uzunluk,
    hak: hakSayisi(d),
    cevap: kelimeSec(d, deneme),
    kural,
    esik: d.esik || 0,
    deneme,
    tahminler: [],
    fener: [],
    gri: [],
    kurabiye: false,
    gozDamlasi: false,
    notlar: {},
    bitti: false,
  };
  if (!b.arada && sahip("kahvefali")) b.gri = yokHarfSec(b, 2, durum.tohum, "kahve");
  if (!b.arada && durum.bedavaFener) {
    b.fener.push(fenerYeriSec(b, durum.tohum));
    b.kayipHarf = true;
    durum.bedavaFener = false;
  }
  return b;
}

function bulmacaCiz() {
  const b = durum.bulmaca;
  // Bitmiş ama sonucu işlenmemiş bulmaca (ör. sayfa tam o anda yenilendi).
  if (b.bitti) return bulmacaBitti({ cozuldu: Boolean(b.cozuldu), kacis: Boolean(b.kacti) });
  aktif = bulmacaAc({
    kap: ekran,
    klavye,
    b,
    tohum: durum.tohum,
    tilsimlar: () => durum.tilsimlar,
    kaydet,
    bitince: bulmacaBitti,
    tilsimSalla,
  });
  if (b.kayipHarf) {
    b.kayipHarf = false;
    kaydet();
    bildir("✨ Kayıp Harf bir harfi açtı", 2000);
  }
}

function bulmacaBitti({ cozuldu, kacis }) {
  if (durum.ekran !== "bulmaca" || !durum.bulmaca) return;
  const b = durum.bulmaca;
  if (kacis) {
    bildir("🏃 Kaçtın: ödül yok, can da gitmedi", 2200);
    dugumuBitir();
    return;
  }
  durum.ist.tahmin += b.tahminler.length;
  const sonuc = { tur: b.tur, kural: b.kural, cevap: b.cevap, arada: b.arada, tahmin: b.tahminler.length, esik: b.esik, cozuldu };
  if (sahip("tespih") && !b.arada) durum.tespih = cozuldu && b.tahminler.length <= 4 ? durum.tespih + 1 : 0;

  if (cozuldu) {
    const p = puanHesapla(b, durum.tilsimlar, durum.tespih);
    sonuc.puan = p;
    sonuc.yeterli = !b.esik || p.puan >= b.esik;
    if (sonuc.yeterli) {
      durum.puan += p.puan;
      durum.ist.cozulen += 1;
      durum.ist.enIyi = Math.max(durum.ist.enIyi, p.puan);
      sonuc.murekkep = murekkepHesapla({
        tur: b.tur,
        kalan: b.hak - b.tahminler.length,
        tilsimlar: durum.tilsimlar,
        eldeki: durum.murekkep,
      });
      durum.murekkep += sonuc.murekkep.toplam;
    }
  }
  if (!sonuc.cozuldu || !sonuc.yeterli) {
    durum.ist.kaybedilen += 1;
    if (sahip("nazar") && !durum.nazarKullanildi) {
      durum.nazarKullanildi = true;
      sonuc.nazar = true;
    } else {
      durum.can -= 1;
    }
    sonuc.tekrar = BOSS_TURLERI.has(b.tur);
  }
  durum.odul = sonuc;
  durum.ekran = "odul";
  kaydet();
  ciz();
}

function tekrarDene() {
  const d = dugumBul(durum.harita, durum.hedef);
  durum.bulmaca = bulmacaHazirla(d, durum.bulmaca.deneme + 1);
  durum.odul = null;
  durum.ekran = "bulmaca";
  kaydet();
  ciz();
}

// ---- Ödül ----
function dokumSatiri(sol, sag, sinif = "") {
  return `<div class="dokum-satiri ${sinif}"><span>${sol}</span><b>${sag}</b></div>`;
}

function tilsimAdi(id) {
  return `${TILSIMLAR[id].simge} ${TILSIMLAR[id].ad}`;
}

function odulCiz() {
  const o = durum.odul;
  const ilkKez = !o.gosterildi;
  o.gosterildi = true;
  kaydet();

  const kelime = `<div class="sonuc-kelimesi">${[...o.cevap]
    .map((h) => `<div class="kare" data-durum="${o.cozuldu ? "dogru" : "var"}">${buyuk(h)}</div>`)
    .join("")}</div>`;
  let baslik;
  if (!o.cozuldu) baslik = "Bulamadın";
  else if (!o.yeterli) baslik = "Buldun ama puan yetmedi";
  else baslik = `${o.tahmin}. tahminde buldun!`;

  // Döküm satırları sırayla belirir; tetiklenen tılsımlar sırası gelince sallanır.
  const satirlar = [];
  const tetikler = [];
  const ekle = (html, tilsim) => {
    if (tilsim) tetikler.push([satirlar.length, tilsim]);
    satirlar.push(html);
  };
  if (o.cozuldu) {
    const p = o.puan;
    ekle("<h3>Taş</h3>");
    ekle(dokumSatiri(p.tas.aciklama, sayi(p.tas.taban)));
    for (const e of p.tas.ekler) ekle(dokumSatiri(tilsimAdi(e.id), `+${e.deger}`, "tilsim"), e.id);
    if (p.tas.kurabiye) ekle(dokumSatiri(`${IKSIRLER.kurabiye.simge} ${IKSIRLER.kurabiye.ad}`, "×2", "tilsim"));
    ekle("<h3>Çarpan</h3>");
    ekle(dokumSatiri(`1 + ${p.carpan.kalan} kalan hak`, p.carpan.taban));
    for (const e of p.carpan.ekler) ekle(dokumSatiri(tilsimAdi(e.id), `+${e.deger}`, "tilsim"), e.id);
    for (const k of p.katlar) ekle(dokumSatiri(tilsimAdi(k.id), `×${virgullu(k.deger)}`, "tilsim"), k.id);
    const formul = `${sayi(p.tas.toplam)} taş × ${p.carpan.toplam}${p.kat !== 1 ? ` × ${virgullu(p.kat)}` : ""}`;
    ekle(`<div class="dokum-toplam"><span>${formul}</span><strong data-sayac="${p.puan}">${sayi(p.puan)}</strong></div>`);
    if (o.esik) {
      ekle(`<p class="esik ${o.yeterli ? "tamam" : "olmadi"}">${o.yeterli ? "✓" : "✗"} Bekçi en az ${o.esik} puan istiyordu</p>`);
    }
    if (o.murekkep) {
      ekle("<h3>Mürekkep</h3>");
      for (const m of o.murekkep.satirlar) {
        ekle(dokumSatiri(m.id ? tilsimAdi(m.id) : m.ad, `+${m.deger}`, m.id ? "tilsim" : ""), m.id);
      }
    }
  }

  let kayip = "";
  if (!o.cozuldu || !o.yeterli) {
    if (o.nazar) kayip = '<p class="kayip-notu">🧿 Nazar Boncuğu canını korudu.</p>';
    else kayip = `<p class="kayip-notu">💔 1 can gitti${durum.can > 0 ? `, ${durum.can} can kaldı` : ""}.</p>`;
    if (o.tekrar && durum.can > 0) kayip += '<p class="soluk-yazi">Boss yerinde duruyor: yeni bir kelimeyle tekrar dene.</p>';
  }

  let dugme;
  if (durum.can <= 0) dugme = ["Seferi bitir", () => seferiBitir(false)];
  else if (o.tekrar) dugme = ["Yeni kelimeyle tekrar dene", tekrarDene];
  else if (o.tur === "bekci") dugme = ["Adayı tamamla", () => seferiBitir(true)];
  else if (o.tur === "miniboss") dugme = ["Tılsımını seç", miniBossOdulu];
  else dugme = ["Haritaya dön", dugumuBitir];

  ekran.innerHTML = `
    <section class="odul-ekrani${ilkKez ? " ilk" : ""}">
      <h2 class="sonuc-basligi">${baslik}</h2>
      ${kelime}
      <a class="anlam" href="https://sozluk.gov.tr/?kelime=${encodeURIComponent(o.cevap)}" target="_blank" rel="noopener">Anlamına bak</a>
      ${satirlar.length ? `<div class="dokum">${satirlar.map((h, i) => `<div class="beliren" style="--sira:${i}">${h}</div>`).join("")}</div>` : ""}
      ${kayip}
      <button class="ana-dugme tam" type="button" id="devam">${dugme[0]}</button>
    </section>`;
  ekran.querySelector("#devam").addEventListener("click", dugme[1]);

  if (ilkKez) {
    for (const [sira, id] of tetikler) setTimeout(() => tilsimSalla(id), SATIR_ARASI * (sira + 1));
    const toplam = ekran.querySelector("[data-sayac]");
    if (toplam) sayacCalistir(toplam, Number(toplam.dataset.sayac), SATIR_ARASI * satirlar.length);
  }
}

function sayacCalistir(el, hedef, gecikme) {
  el.textContent = "0";
  setTimeout(() => {
    const basla = performance.now();
    const sure = 700;
    const adim = (simdi) => {
      const oran = Math.min(1, (simdi - basla) / sure);
      el.textContent = sayi(Math.round(hedef * (1 - (1 - oran) ** 3)));
      if (oran < 1) requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  }, gecikme);
}

function miniBossOdulu() {
  durum.secim = {
    baslik: "Mini boss ödülü",
    metin: "Üç tılsımdan birini seç.",
    secenekler: tilsimSec(zar(durum.tohum, "odul", durum.hedef), 3),
  };
  durum.ekran = "secim";
  kaydet();
  ciz();
}

// ---- Tılsım seçimi (mini boss, Sahaf, Yorgun Yolcu) ----
function secimCiz() {
  const s = durum.secim;
  const dolu = durum.tilsimlar.length >= YUVA.tilsim;
  ekran.innerHTML = `
    <section class="olay">
      <h2>${s.baslik}</h2>
      <p>${s.metin}</p>
      <div class="raf">${s.secenekler.map((id) => urunKarti(id, `<button class="urun-al" type="button" data-sec="${id}">Seç</button>`)).join("")}</div>
      ${dolu ? '<p class="soluk-yazi">Yuvaların dolu: seçersen yerine birini satacaksın.</p>' : ""}
      <button class="duz-dugme cerceveli" type="button" id="gec">${s.gecMetni || "Hiçbirini alma"}</button>
    </section>`;
  for (const btn of ekran.querySelectorAll("[data-sec]")) {
    btn.addEventListener("click", () => tilsimEkle(btn.dataset.sec, dugumuBitir));
  }
  ekran.querySelector("#gec").addEventListener("click", dugumuBitir);
}

// ---- Pazar ----
function pazarHazirla(id, yenileme) {
  const r = zar(durum.tohum, "pazar", id, yenileme);
  return {
    yenileme,
    tilsimlar: tilsimSec(r, PAZAR.tilsim),
    iksirler: karistir(r, Object.keys(IKSIRLER)).slice(0, PAZAR.iksir),
    alinan: [],
  };
}

function pazarCiz() {
  const p = durum.pazar;
  const yenileFiyati = fiyat(PAZAR.yenile + p.yenileme);
  const iksirDolu = durum.iksirler.length >= YUVA.iksir;
  const tilsimKartlari = p.tilsimlar
    .map((id, i) => {
      const f = fiyat(tilsimFiyati(id));
      const alindi = p.alinan.includes(`t${i}`);
      const dugme = `<button class="urun-al" type="button" data-al="t${i}" ${alindi || durum.murekkep < f ? "disabled" : ""}>${alindi ? "Alındı" : `${f} ${DAMLA}`}</button>`;
      return urunKarti(id, dugme, alindi ? " alindi" : "");
    })
    .join("");
  const iksirKartlari = p.iksirler
    .map((id, i) => {
      const k = IKSIRLER[id];
      const f = fiyat(k.fiyat);
      const alindi = p.alinan.includes(`i${i}`);
      const yazi = alindi ? "Alındı" : iksirDolu ? "Yuva dolu" : `${f} ${DAMLA}`;
      return `<div class="urun iksir${alindi ? " alindi" : ""}">
        <span class="urun-simge">${k.simge}</span><strong>${k.ad}</strong><small class="nadirlik">İksir</small>
        <p>${k.aciklama}</p>
        <button class="urun-al" type="button" data-al="i${i}" ${alindi || iksirDolu || durum.murekkep < f ? "disabled" : ""}>${yazi}</button>
      </div>`;
    })
    .join("");

  ekran.innerHTML = `
    <section class="pazar">
      <div class="olay-basligi"><span class="olay-simge">🧺</span><div><h2>Pazar</h2><p>Tılsımlar sefer boyunca seninle; iksirler tek kullanımlık.</p></div></div>
      <h3>Tılsımlar</h3>
      <div class="raf">${tilsimKartlari || '<p class="soluk-yazi">Raf boş.</p>'}</div>
      <h3>İksirler</h3>
      <div class="raf">${iksirKartlari}</div>
      <div class="pazar-alt">
        <button class="duz-dugme cerceveli" type="button" id="yenile" ${durum.murekkep < yenileFiyati ? "disabled" : ""}>Yenile · ${yenileFiyati} ${DAMLA}</button>
        <button class="ana-dugme" type="button" id="cik">Pazardan çık</button>
      </div>
      <p class="soluk-yazi">Tılsım satmak için yukarıdaki tılsımına dokun.</p>
    </section>`;

  for (const btn of ekran.querySelectorAll("[data-al]")) {
    btn.addEventListener("click", () => {
      const anahtar = btn.dataset.al;
      const sira = Number(anahtar.slice(1));
      if (anahtar[0] === "t") {
        const id = p.tilsimlar[sira];
        tilsimEkle(id, () => {
          durum.murekkep -= fiyat(tilsimFiyati(id));
          p.alinan.push(anahtar);
          kaydet();
          ciz();
        });
      } else {
        const id = p.iksirler[sira];
        durum.murekkep -= fiyat(IKSIRLER[id].fiyat);
        durum.iksirler.push(id);
        p.alinan.push(anahtar);
        kaydet();
        ciz();
      }
    });
  }
  ekran.querySelector("#yenile").addEventListener("click", () => {
    durum.murekkep -= yenileFiyati;
    durum.pazar = pazarHazirla(durum.hedef, p.yenileme + 1);
    kaydet();
    ciz();
  });
  ekran.querySelector("#cik").addEventListener("click", () => {
    if (sahip("esnaf") && durum.murekkep > PAZAR.esnafSiniri) {
      durum.murekkep += PAZAR.esnafOdulu;
      bildir(`⚖️ Esnaf: +${PAZAR.esnafOdulu} mürekkep`);
    }
    dugumuBitir();
  });
}

// ---- Çeşme ----
function cesmeCiz() {
  const dolu = durum.can >= durum.canSiniri;
  ekran.innerHTML = `
    <section class="olay">
      <div class="olay-simge buyuk" aria-hidden="true">⛲</div>
      <h2>Çeşme</h2>
      <p>Yol kenarında serin bir çeşme. Bir yudum iç ya da hokkanı mürekkeple doldur.</p>
      <div class="secenekler">
        <button class="secenek" type="button" id="can" ${dolu ? "disabled" : ""}>
          <span class="secenek-simge">❤️</span><strong>1 can yenile</strong><small>${dolu ? "Canın zaten dolu" : `${durum.can} → ${durum.can + 1} can`}</small>
        </button>
        <button class="secenek" type="button" id="murekkep">
          <span class="secenek-simge">${DAMLA}</span><strong>${ODUL.cesme} mürekkep al</strong><small>${durum.murekkep} → ${durum.murekkep + ODUL.cesme}</small>
        </button>
      </div>
    </section>`;
  ekran.querySelector("#can").addEventListener("click", () => {
    durum.can += 1;
    dugumuBitir();
  });
  ekran.querySelector("#murekkep").addEventListener("click", () => {
    durum.murekkep += ODUL.cesme;
    dugumuBitir();
  });
}

// ---- Sürprizler ----
function sonucYaz(metin) {
  durum.olay.adim = "sonuc";
  durum.olay.sonuc = metin;
  kaydet();
  ciz();
}

function secimeGec(baslik, metin, secenekler, gecMetni) {
  if (!secenekler.length) return sonucYaz("Heybe boş çıktı; yine de yolun açık olsun.");
  durum.secim = { baslik, metin, secenekler, gecMetni };
  durum.olay = null;
  durum.ekran = "secim";
  kaydet();
  ciz();
}

const SURPRIZLER = {
  sahaf: () => [
    {
      metin: `Tılsımı al · 4 ${DAMLA}`,
      kapali: durum.murekkep < 4,
      is: () => {
        durum.murekkep -= 4;
        const secilen = tilsimSec(zar(durum.tohum, "sahaf", durum.hedef), 1);
        secimeGec("Sahaf", "Kitabın arasından bu tılsım çıktı.", secilen, "Bırak");
      },
    },
  ],
  kumarbaz: () => [
    {
      metin: "Yazı tura at",
      kapali: durum.murekkep < 1,
      is: () => {
        const once = durum.murekkep;
        const tuttu = zar(durum.tohum, "kumarbaz", durum.hedef)() < 0.5;
        durum.murekkep = tuttu ? once * 2 : Math.floor(once / 2);
        sonucYaz(
          tuttu
            ? `Tuttu! Mürekkebin ikiye katlandı: ${once} → ${durum.murekkep}.`
            : `Tutmadı. Mürekkebin yarıya indi: ${once} → ${durum.murekkep}.`
        );
      },
    },
  ],
  yolcu: () => [
    {
      metin: "1 can ver",
      kapali: durum.can <= 1,
      not: durum.can <= 1 ? "Son canını veremezsin." : "",
      is: () => {
        durum.can -= 1;
        const secenekler = tilsimSec(zar(durum.tohum, "yolcu", durum.hedef), 3, ["nadir"]);
        secimeGec("Yorgun Yolcu", "Yolcu heybesini açtı: birini seç.", secenekler);
      },
    },
  ],
  kayipharf: () => [
    {
      metin: "Cebine koy",
      ana: true,
      is: () => {
        durum.bedavaFener = true;
        sonucYaz("Bir sonraki bulmacada bir harf kendiliğinden açılacak.");
      },
    },
  ],
  kuyu: () => [
    {
      metin: `8 mürekkep al`,
      is: () => {
        durum.murekkep += 8;
        durum.sonrakiKural = "karakoncolos";
        sonucYaz("Hokkan doldu: +8 mürekkep. Karakoncolos bir sonraki bulmacada seni bekliyor.");
      },
    },
  ],
};

function surprizCiz() {
  const o = durum.olay;
  const bilgi = OLAYLAR[o.tur];
  let secenekler;
  if (o.adim === "sonuc") secenekler = [{ metin: "Devam", ana: true, is: dugumuBitir }];
  else {
    secenekler = SURPRIZLER[o.tur]();
    if (!secenekler.some((s) => s.ana)) secenekler.push({ metin: "Geç", is: dugumuBitir, gec: true });
  }
  ekran.innerHTML = `
    <section class="olay">
      <div class="olay-simge buyuk" aria-hidden="true">${bilgi.simge}</div>
      <h2>${bilgi.ad}</h2>
      <p>${o.adim === "sonuc" ? o.sonuc : bilgi.metin}</p>
      <div class="secenekler">${secenekler
        .map(
          (s, i) =>
            `<button class="${s.gec ? "duz-dugme cerceveli" : "ana-dugme tam"}" type="button" data-secenek="${i}" ${s.kapali ? "disabled" : ""}>${s.metin}</button>${s.not ? `<small class="soluk-yazi">${s.not}</small>` : ""}`
        )
        .join("")}</div>
    </section>`;
  for (const btn of ekran.querySelectorAll("[data-secenek]")) {
    btn.addEventListener("click", () => secenekler[Number(btn.dataset.secenek)].is());
  }
}

// ---- Sefer sonu ----
function ulasilanKatman() {
  const id = durum.hedef || durum.konum;
  return id ? dugumBul(durum.harita, id).katman + 1 : 1;
}

function seferiBitir(kazandi) {
  const katman = ulasilanKatman();
  if (kazandi) {
    durum.konum = durum.hedef;
    durum.gecilen.push(durum.hedef);
  }
  durum.bitti = true;
  durum.kazandi = kazandi;
  durum.katman = katman;
  durum.ekran = "son";
  durum.bulmaca = durum.odul = null;
  kaydet();
  const gecmis = oku(GECMIS, []);
  gecmis.unshift({
    tarih: Date.now(),
    puan: durum.puan,
    kazandi,
    katman,
    sure: Math.round(durum.sure / 60000),
    cozulen: durum.ist.cozulen,
    tilsimlar: durum.tilsimlar,
    alinan: durum.alinan,
  });
  yaz(GECMIS, gecmis.slice(0, 20));
  ciz();
}

function paylasimMetni() {
  const sonuc = durum.kazandi ? `${ADA_ADI} geçildi 🏆` : `${ADA_ADI} · ${durum.katman}/${KATMAN_SAYISI}. katman`;
  const tilsimlar = durum.tilsimlar.map((t) => TILSIMLAR[t].simge).join("");
  return `Harfoni · Harf Adaları (deneme)\n${sonuc} · ${sayi(durum.puan)} puan${tilsimlar ? `\n${tilsimlar}` : ""}\n\n${location.origin}${location.pathname}`;
}

function sonCiz() {
  const k = durum.kazandi;
  ekran.innerHTML = `
    <section class="olay sefer-sonu">
      <div class="olay-simge buyuk" aria-hidden="true">${k ? "🏆" : "🌊"}</div>
      <h2>${k ? `${ADA_ADI}'nı geçtin!` : "Sefer bitti"}</h2>
      <p>${
        k
          ? "Ada bekçisini yendin. Deneme sürümünde şimdilik tek ada var; Sözlük Ormanı ve Muamma Dağı yolda."
          : `Canın ${ADA_ADI}'nın ${durum.katman}. katmanında bitti. Bir dahaki sefere!`
      }</p>
      <div class="ozet-izgara">
        <div><strong>${sayi(durum.puan)}</strong><span>Puan</span></div>
        <div><strong>${durum.ist.cozulen}</strong><span>Çözülen</span></div>
        <div><strong>${durum.katman}/${KATMAN_SAYISI}</strong><span>Katman</span></div>
        <div><strong>${dakika(durum.sure)}</strong><span>Süre</span></div>
      </div>
      ${
        durum.tilsimlar.length
          ? `<h3>Tılsımların</h3><div class="tilsim-cipleri">${durum.tilsimlar.map((t) => `<span>${tilsimAdi(t)}</span>`).join("")}</div>`
          : ""
      }
      <div class="a-dugmeler">
        <button class="ana-dugme" type="button" id="yeni">Yeni sefer</button>
        <button class="duz-dugme cerceveli" type="button" id="paylas">Paylaş</button>
        <a class="duz-dugme" href="./">Ana sayfaya dön</a>
      </div>
    </section>`;
  ekran.querySelector("#yeni").addEventListener("click", yeniSefer);
  ekran.querySelector("#paylas").addEventListener("click", () => paylas(paylasimMetni()));
}

// ---- Başlangıç ----
// Üstteki geri düğmesi seferdeyken menüye, menüdeyken ana sayfaya götürür.
document.getElementById("geri").addEventListener("click", (e) => {
  if (menude || !durum) return;
  e.preventDefault();
  menude = true;
  ciz();
});

pencereleriBagla();
if (!oku("adalar.yardim-goruldu", false)) {
  pencereAc("yardim-penceresi");
  yaz("adalar.yardim-goruldu", true);
}
ciz();
