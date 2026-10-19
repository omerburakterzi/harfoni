// Klasik günlük sıralaması: oyun bitince sonucu sunucuya gönderir, sonuç
// penceresinde puanı ve sırayı gösterir, sıralama penceresini doldurur.
// Sıralamaya katılmak için Düello'daki takma ad (profil) kullanılır.

import { oku, yaz } from "./depo.js";
import { istek } from "./sunucu.js";
import { pencereAc } from "./arayuz.js";

const $ = (id) => document.getElementById(id);
const DONEM_ADI = { gun: "Bugün", hafta: "Bu hafta", ay: "Bu ay" };

function kimlik() {
  const k = oku("duello.kimlik", null);
  return k && oku("duello.kimlik.ad", null) ? k : null;
}

function ozetiGoster(sonuc) {
  const kap = $("siralama-ozet");
  kap.hidden = false;
  if (!sonuc) {
    kap.innerHTML = `<p>Sıralamada yerini görmek için <a href="duello.html">Düello'da takma ad seç</a>. Sonraki günlük oyunların puanlanır.</p>`;
    return;
  }
  const sira = sonuc.sira ? `Bugün ${sonuc.toplam} kişi arasında <strong>${sonuc.sira.sira}.</strong> sıradasın.` : "";
  kap.innerHTML = sonuc.gecerli
    ? `<p><strong class="kazanilan-puan">+${sonuc.puan} puan</strong> ${sira}</p>`
    : `<p>Bu sonuç sıralamaya alınmadı.</p>`;
  const dugme = document.createElement("button");
  dugme.type = "button";
  dugme.className = "duz-dugme cerceveli";
  dugme.textContent = "Sıralamayı gör";
  dugme.addEventListener("click", () => siralamayiAc("gun"));
  kap.appendChild(dugme);
}

// Günlük oyun bitince çağrılır.
export async function gunlukSonucuGonder({ gun, tahminler, kazandi, sure }) {
  const k = kimlik();
  if (!k) return ozetiGoster(null);
  const onceki = oku("klasik.siralama", null);
  if (onceki?.gun === gun) return ozetiGoster(onceki);
  try {
    const sonuc = await istek("/klasik/sonuc", { ...k, gun, tahminler, sure, kazandi });
    yaz("klasik.siralama", { gun, ...sonuc });
    ozetiGoster({ gun, ...sonuc });
  } catch {
    // İnternet yoksa bir sonraki açılışta yeniden denenir.
    $("siralama-ozet").hidden = true;
  }
}

let acikDonem = "gun";

async function listeyiDoldur(donem) {
  acikDonem = donem;
  for (const sekme of document.querySelectorAll("[data-donem]")) sekme.classList.toggle("secili", sekme.dataset.donem === donem);
  const liste = $("siralama-liste");
  liste.innerHTML = `<li class="soluk-yazi">Yükleniyor…</li>`;
  let veri;
  try {
    veri = await istek("/siralama", { donem, ...(kimlik() || {}) });
  } catch (hata) {
    liste.innerHTML = `<li class="soluk-yazi">${hata.message}</li>`;
    return;
  }
  if (acikDonem !== donem) return;
  $("siralama-bilgi").textContent = veri.toplam ? `${DONEM_ADI[donem]} ${veri.toplam} kişi oynadı.` : `${DONEM_ADI[donem]} henüz kimse yok. İlk sen ol!`;
  liste.innerHTML = "";
  for (const s of veri.liste) {
    const li = document.createElement("li");
    li.className = s.ben ? "ben" : "";
    li.innerHTML = `<span class="sira-no">${s.sira}</span><span class="sira-ad"></span><span class="sira-puan">${s.puan}</span>`;
    li.querySelector(".sira-ad").textContent = s.ad;
    liste.appendChild(li);
  }
  const ben = $("siralama-ben");
  const listedeyim = veri.liste.some((s) => s.ben);
  ben.hidden = !veri.ben || listedeyim;
  if (veri.ben && !listedeyim) ben.innerHTML = `Sen: <strong>${veri.ben.sira}.</strong> sıra · ${veri.ben.puan} puan`;
  $("siralama-katil").hidden = Boolean(kimlik());
}

export function siralamayiAc(donem = "gun") {
  pencereAc("siralama-penceresi");
  listeyiDoldur(donem);
}

export function siralamaKur() {
  $("siralama-ac")?.addEventListener("click", () => siralamayiAc(acikDonem));
  for (const sekme of document.querySelectorAll("[data-donem]")) {
    sekme.addEventListener("click", () => listeyiDoldur(sekme.dataset.donem));
  }
}
