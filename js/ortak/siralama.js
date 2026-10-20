// Harfoni Puanı ve sıralama: günlük oyun bitince sonucu sunucuya gönderir,
// sonuç penceresinde kazanılan puanı ve sırayı, sıralama penceresinde de
// bugünün / bu haftanın / bu ayın listesini gösterir. Sayfaya gereken düğme
// ve pencereyi kendisi ekler. Sıralamaya katılmak için Düello'daki takma ad
// (profil) kullanılır.

import { oku, yaz } from "./depo.js";
import { istek } from "./sunucu.js";
import { pencereAc } from "./arayuz.js";

const $ = (id) => document.getElementById(id);
const DONEM_ADI = { gun: "Bugün", hafta: "Bu hafta", ay: "Bu ay" };
const OYUN_ADI = { hepsi: "Tümü", klasik: "Klasik", palavra: "Palavra", arada: "Arada", muamma: "Muamma" };

const KUPA =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>';

export function kimlik() {
  const k = oku("duello.kimlik", null);
  return k && oku("duello.kimlik.ad", null) ? k : null;
}

let acikDonem = "hafta";
let acikOyun = "hepsi";

// ---------- Sayfaya eklenenler ----------

function pencereyiEkle() {
  if ($("siralama-penceresi")) return;
  const pencere = document.createElement("dialog");
  pencere.id = "siralama-penceresi";
  pencere.className = "pencere";
  pencere.innerHTML = `
    <button class="kapat" type="button" data-kapat aria-label="Kapat">×</button>
    <h2>Sıralama</h2>
    <div class="sekmeler" role="tablist">
      ${Object.entries(DONEM_ADI).map(([d, ad]) => `<button type="button" data-donem="${d}">${ad}</button>`).join("")}
    </div>
    <div class="sekmeler kucuk-sekmeler" role="tablist">
      ${Object.entries(OYUN_ADI).map(([o, ad]) => `<button type="button" data-oyun="${o}">${ad}</button>`).join("")}
    </div>
    <p id="siralama-bilgi" class="aciklama"></p>
    <ol id="siralama-liste" class="siralama-liste"></ol>
    <p id="siralama-ben" class="siralama-ben" hidden></p>
    <p id="siralama-katil" class="aciklama" hidden>Sıralamaya katılmak için <a href="duello.html">Düello'da takma ad seç</a>. Sonraki günlük oyunların puanlanır.</p>
    <details class="puan-aciklamasi">
      <summary>Puanlar nasıl hesaplanıyor?</summary>
      <ul>
        <li><strong>Klasik:</strong> 1. tahmin 100, 2. 80, 3. 60, 4. 40, 5. 25, 6. 10</li>
        <li><strong>Palavra, Muamma:</strong> 100, 90, 80, 65, 50, 35, 25, 15</li>
        <li><strong>Arada:</strong> 5 tahmine kadar 100, sonra her tahminde 10 eksik (en az 10)</li>
        <li>Bulamasan da oynadığın için <strong>5</strong> puan</li>
        <li>Aynı gün dört oyunu da bitirirsen <strong>+20</strong></li>
        <li>Seri: 3 gün üst üste oynarsan günde <strong>+10</strong>, 7 günden sonra <strong>+20</strong></li>
      </ul>
      <p>Sadece günlük oyunlar sayılır. Eşit puanda daha hızlı çözen önde.</p>
    </details>`;
  document.body.appendChild(pencere);
  // Ana sayfada pencereleriBagla yok; kapatmayı burada da bağla.
  pencere.addEventListener("click", (e) => {
    if (e.target === pencere || e.target.closest("[data-kapat]")) pencere.close();
  });
  for (const d of pencere.querySelectorAll("[data-donem]")) d.addEventListener("click", () => listeyiDoldur(d.dataset.donem, acikOyun));
  for (const o of pencere.querySelectorAll("[data-oyun]")) o.addEventListener("click", () => listeyiDoldur(acikDonem, o.dataset.oyun));
}

function ustDugmeyiEkle() {
  const yer = $("istatistik-ac");
  if (!yer || $("siralama-ac")) return;
  const dugme = document.createElement("button");
  dugme.className = "ikon-dugme";
  dugme.type = "button";
  dugme.id = "siralama-ac";
  dugme.setAttribute("aria-label", "Sıralama");
  dugme.innerHTML = KUPA;
  dugme.addEventListener("click", () => siralamayiAc());
  yer.before(dugme);
}

function ozetKutusu() {
  let kap = $("siralama-ozet");
  if (!kap) {
    kap = document.createElement("div");
    kap.id = "siralama-ozet";
    kap.className = "siralama-ozet";
    kap.hidden = true;
    $("dagilim")?.after(kap);
  }
  return kap;
}

// Oyun sayfalarında: kupa düğmesi ve sıralama penceresi. sayfaKur'dan önce
// çağrılmalı ki pencerenin kapat düğmesi de bağlansın.
export function siralamaKur() {
  pencereyiEkle();
  ustDugmeyiEkle();
  ozetKutusu();
}

// ---------- Sonuç gönderme ----------

function ozetiGoster(oyun, sonuc) {
  const kap = ozetKutusu();
  kap.hidden = false;
  if (!sonuc) {
    kap.innerHTML = `<p>Puan toplayıp sıralamaya girmek için <a href="duello.html">Düello'da takma ad seç</a>.</p>`;
    return;
  }
  const satirlar = [];
  if (sonuc.gecerli) {
    satirlar.push(`<strong class="kazanilan-puan">+${sonuc.puan} puan</strong>`);
    if (sonuc.oyunSayisi >= 4) satirlar.push("Dört oyunun dördü de bitti: <strong>+20</strong>");
    if (sonuc.seri >= 3) satirlar.push(`🔥 ${sonuc.seri} günlük seri: <strong>+${sonuc.seri >= 7 ? 20 : 10}</strong>`);
    if (sonuc.sira) satirlar.push(`Bugün ${sonuc.toplam} kişi arasında <strong>${sonuc.sira.sira}.</strong> sıradasın (ilk %${sonuc.sira.yuzde})`);
  } else {
    satirlar.push("Bu sonuç sıralamaya alınmadı.");
  }
  kap.innerHTML = satirlar.map((s) => `<p>${s}</p>`).join("");
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "duz-dugme cerceveli";
  dugme.textContent = "Sıralamayı gör";
  dugme.addEventListener("click", () => siralamayiAc("gun", "hepsi"));
  kap.appendChild(dugme);
}

// Günlük oyun bitince çağrılacak fonksiyonu döner.
export function gunlukSonucuGonder(oyun) {
  return async ({ gun, tahminler, kazandi, sure }) => {
    const k = kimlik();
    if (!k) return ozetiGoster(oyun, null);
    const anahtar = `${oyun}.siralama`;
    const onceki = oku(anahtar, null);
    if (onceki?.gun === gun) return ozetiGoster(oyun, onceki);
    try {
      const sonuc = await istek("/gunluk/sonuc", { ...k, oyun, gun, tahminler, sure, kazandi });
      yaz(anahtar, { gun, ...sonuc });
      ozetiGoster(oyun, { gun, ...sonuc });
    } catch {
      // İnternet yoksa bir sonraki açılışta yeniden denenir.
      ozetKutusu().hidden = true;
    }
  };
}

// ---------- Sıralama penceresi ----------

async function listeyiDoldur(donem, oyun) {
  acikDonem = donem;
  acikOyun = oyun;
  for (const d of document.querySelectorAll("#siralama-penceresi [data-donem]")) d.classList.toggle("secili", d.dataset.donem === donem);
  for (const o of document.querySelectorAll("#siralama-penceresi [data-oyun]")) o.classList.toggle("secili", o.dataset.oyun === oyun);
  const liste = $("siralama-liste");
  liste.innerHTML = `<li class="soluk-yazi">Yükleniyor…</li>`;
  let veri;
  try {
    veri = await istek("/siralama", { donem, oyun: oyun === "hepsi" ? null : oyun, ...(kimlik() || {}) });
  } catch (hata) {
    liste.innerHTML = `<li class="soluk-yazi">${hata.message}</li>`;
    return;
  }
  if (acikDonem !== donem || acikOyun !== oyun) return;
  $("siralama-bilgi").textContent = veri.toplam ? `${DONEM_ADI[donem]} ${veri.toplam} kişi puan aldı.` : `${DONEM_ADI[donem]} henüz kimse yok. İlk sen ol!`;
  liste.innerHTML = "";
  for (const s of veri.liste) {
    const li = document.createElement("li");
    if (s.ben) li.className = "ben";
    li.innerHTML = `<span class="sira-no">${s.sira}</span><span class="sira-ad"></span><span class="sira-puan">${s.puan}</span>`;
    li.querySelector(".sira-ad").textContent = s.ad;
    liste.appendChild(li);
  }
  const ben = $("siralama-ben");
  const listedeyim = veri.liste.some((s) => s.ben);
  ben.hidden = !veri.ben || listedeyim;
  if (veri.ben && !listedeyim) ben.innerHTML = `Sen: <strong>${veri.ben.sira}.</strong> sıra · ${veri.ben.puan} puan · ilk %${veri.ben.yuzde}`;
  $("siralama-katil").hidden = Boolean(kimlik());
}

export function siralamayiAc(donem = acikDonem, oyun = acikOyun) {
  pencereyiEkle();
  pencereAc("siralama-penceresi");
  listeyiDoldur(donem, oyun);
}
