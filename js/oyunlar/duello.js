// Düello: iki kişi aynı kelimeyi aynı anda arar. Daha az tahminde bulan
// kazanır; tahmin sayısı eşitse daha erken bulan.
// Oyunun kendisi sunucuda döner (gizli kelime, süre, tahminler); bu sayfa
// sunucudan gelen "durum" mesajlarını ekrana çizer ve tahminleri gönderir.

import { GECERLI } from "../kelimeler.js";
import { buyuk } from "../ortak/turkce.js";
import { oku, yaz } from "../ortak/depo.js";
import { klavyeKur } from "../ortak/klavye.js";
import { bildir, pencereAc, pencereleriBagla, paylas } from "../ortak/arayuz.js";
import { YEREL, WS_SUNUCU, DUELLO_ADRESI, istek } from "../ortak/sunucu.js";

const UZUNLUK = 5;
const CEVIRME_ARASI = 280;
const EMOJI = { dogru: "🟦", var: "🟧", yok: "⬛" };
const MODLAR = {
  hizli: { ad: "Hızlı", aciklama: "3 dakika + bonus" },
  uzun: { ad: "Uzun", aciklama: "10 dakika" },
};

const $ = (id) => document.getElementById(id);
const parametreler = new URLSearchParams(location.search);

// Kendi bilgisayarımızda iki sekmeyle denerken her sekme ayrı oyuncu olabilsin (?k=2).
const KIMLIK_ANAHTARI = "duello.kimlik" + (YEREL && parametreler.get("k") ? "." + parametreler.get("k") : "");

let kimlik;
let profil = null;
let odaKodu = null;
let ws = null;
let aramaSoketi = null;
let aramaBaslangici = 0;
let secilenMod = oku("duello.mod", "hizli");
let yenidenDeneme = 0;
let hicMesajGelmedi = true;

let durum = null; // sunucudan gelen son durum
let saatFarki = 0; // sunucu saati - cihaz saati
let oyunAnahtari = null; // yeni oyun (rövanş) başladığını anlamak için
let cizilenSatir = 0;
let mevcut = "";
let kilitli = false;
let sonucGosterildi = false;
let oncekiBitis = null; // bonus geldiğini anlamak için
let bekleBildirildi = false;
let rakipBulduBildirildi = false;

const tahta = $("tahta");
const klavye = klavyeKur($("klavye"), tusaBasildi);

// ---------- Kimlik ve profil ----------

function rastgeleHex() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function kimlikAl() {
  let k = oku(KIMLIK_ANAHTARI, null);
  if (!k || !k.id || !k.anahtar) {
    k = { id: rastgeleHex(), anahtar: rastgeleHex() };
    yaz(KIMLIK_ANAHTARI, k);
  }
  return k;
}

function profiliGoster() {
  $("profil-ac").hidden = !profil;
  if (!profil) return;
  $("yasak-uyarisi").hidden = !profil.yasakli;
  $("rakip-bul").disabled = profil.yasakli;
  $("davet-et").disabled = profil.yasakli;
  $("lobi-ad").textContent = profil.ad;
  for (const mod of Object.keys(MODLAR)) {
    const p = profil.puanlar[mod];
    $(`lobi-puan-${mod}`).textContent = p.puan;
    $(`profil-puan-${mod}`).textContent = p.puan;
    $(`profil-mac-${mod}`).textContent = p.mac;
    $(`profil-galibiyet-${mod}`).textContent = p.galibiyet;
    $(`profil-beraberlik-${mod}`).textContent = p.beraberlik;
  }
  $("profil-ad").value = profil.ad;
}

async function adKaydet(ad) {
  profil = await istek("/oyuncu", { ...kimlik, ad });
  yaz(KIMLIK_ANAHTARI + ".ad", profil.ad);
  profiliGoster();
}

async function profilYenile() {
  try {
    profil = await istek("/oyuncu/bilgi", kimlik);
    profiliGoster();
  } catch {
    // önemli değil; bir sonraki seferde yenilenir
  }
}

// ---------- Ekranlar ----------

function ekranGoster(ad) {
  for (const ekran of ["yukleniyor", "ad", "lobi", "arama", "bekleme", "oyun"]) $(`ekran-${ekran}`).hidden = ekran !== ad;
  if (ad !== "oyun") $("geri-sayim-ortu").hidden = true;
}

function lobiyeDon(mesaj) {
  baglantiyiKapat();
  aramayiBitir();
  odaKodu = null;
  durum = null;
  oyunAnahtari = null;
  history.replaceState(null, "", location.pathname + (YEREL && parametreler.get("k") ? `?k=${parametreler.get("k")}` : ""));
  $("sonuc-penceresi").close();
  $("alt-baslik").textContent = "";
  ekranGoster("lobi");
  profilYenile();
  if (mesaj) bildir(mesaj, 2500);
}

async function davetEt(dugme) {
  aramayiBitir();
  dugme.disabled = true;
  try {
    const { kod } = await istek("/duello", { mod: secilenMod });
    odaKodu = kod;
    const k = YEREL && parametreler.get("k") ? `&k=${parametreler.get("k")}` : "";
    history.replaceState(null, "", `?oda=${kod}${k}`);
    baglan();
  } catch (hata) {
    bildir(hata.message, 2500);
  } finally {
    dugme.disabled = false;
  }
}

// ---------- Rastgele rakip ----------

function modSec(mod) {
  secilenMod = mod;
  yaz("duello.mod", mod);
  for (const dugme of document.querySelectorAll("[data-mod]")) {
    dugme.setAttribute("aria-checked", String(dugme.dataset.mod === mod));
  }
}

function rakipAra() {
  aramaSoketiniKapat();
  if (!aramaBaslangici) aramaBaslangici = Date.now();
  ekranGoster("arama");
  $("arama-mod").textContent = `${MODLAR[secilenMod].ad} mod · ${MODLAR[secilenMod].aciklama}`;
  const soket = new WebSocket(`${WS_SUNUCU}/eslestir`);
  aramaSoketi = soket;
  soket.onopen = () => soket.send(JSON.stringify({ t: "ara", ...kimlik, mod: secilenMod }));
  soket.onmessage = (olay) => {
    const mesaj = JSON.parse(olay.data);
    if (mesaj.t !== "bulundu") return;
    aramaSoketi = null;
    aramaBaslangici = 0;
    odaKodu = mesaj.kod;
    const k = YEREL && parametreler.get("k") ? `&k=${parametreler.get("k")}` : "";
    history.replaceState(null, "", `?oda=${odaKodu}${k}`);
    baglan();
  };
  soket.onclose = (olay) => {
    if (aramaSoketi !== soket) return; // bulundu ya da vazgeçildi
    aramaSoketi = null;
    if (olay.code === 4002) return lobiyeDon(olay.reason);
    if (olay.code === 4000) return lobiyeDon("Başka bir sekmede rakip aranıyor");
    setTimeout(() => {
      if (!aramaSoketi && aramaBaslangici) rakipAra();
    }, 2000);
  };
}

// Oyuncu vazgeçti ya da başka bir şeye geçti.
function aramayiBitir() {
  aramaBaslangici = 0;
  aramaSoketiniKapat();
}

function aramaSoketiniKapat() {
  if (!aramaSoketi) return;
  const eski = aramaSoketi;
  aramaSoketi = null;
  eski.close();
}

function aramaSaatiniGuncelle() {
  if (!aramaBaslangici || $("ekran-arama").hidden) return;
  const gecen = (Date.now() - aramaBaslangici) / 1000;
  $("arama-sure").textContent = sureYazisi(gecen);
  $("arama-oneri").hidden = gecen < 30;
}
setInterval(aramaSaatiniGuncelle, 500);

function davetAdresi() {
  return `${DUELLO_ADRESI}?oda=${odaKodu}`;
}

async function davetiPaylas() {
  const metin = `Harfoni Düello'da sana meydan okuyorum! ⚔️ Aynı kelimeyi aynı anda arıyoruz, daha az tahminde bulan kazanır. (${MODLAR[durum?.mod]?.ad || "Hızlı"} mod)\n${davetAdresi()}`;
  const dokunmatik = window.matchMedia("(pointer: coarse)").matches;
  if (dokunmatik && navigator.share) {
    try {
      await navigator.share({ text: metin });
      return;
    } catch (hata) {
      if (hata.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(metin);
    bildir("Bağlantı kopyalandı");
  } catch {
    bildir("Kopyalanamadı");
  }
}

// ---------- Bağlantı ----------

function baglan() {
  baglantiyiKapat();
  $("alt-baslik").textContent = "Bağlanıyor…";
  const soket = new WebSocket(`${WS_SUNUCU}/duello/${odaKodu}`);
  ws = soket;
  soket.onopen = () => soket.send(JSON.stringify({ t: "merhaba", ...kimlik }));
  soket.onmessage = (olay) => {
    if (ws !== soket) return;
    yenidenDeneme = 0;
    hicMesajGelmedi = false;
    mesajIsle(JSON.parse(olay.data));
  };
  soket.onclose = (olay) => {
    if (ws !== soket) return; // bilerek kapattık
    ws = null;
    if (olay.code === 4003) {
      // Eşleşen rakip odaya gelmedi: aramaya geri dön.
      odaKodu = null;
      bildir("Rakip bağlanamadı, yeniden aranıyor…", 2500);
      return rakipAra();
    }
    if (olay.code === 4002 || olay.code === 4001) return lobiyeDon(olay.reason || "Oda kapandı");
    if (olay.code === 4000) {
      $("alt-baslik").textContent = "Başka bir sekmede açık";
      return;
    }
    if (hicMesajGelmedi && yenidenDeneme >= 2) return lobiyeDon("Oda bulunamadı ya da süresi doldu");
    // Bağlantı koptu: biraz bekleyip yeniden dene.
    $("alt-baslik").textContent = "Bağlantı koptu, yeniden bağlanıyor…";
    const bekle = Math.min(8000, 1000 * 2 ** yenidenDeneme++);
    setTimeout(() => {
      if (odaKodu && !ws) baglan();
    }, bekle);
  };
}

function baglantiyiKapat() {
  if (!ws) return;
  const eski = ws;
  ws = null;
  eski.close();
}

// Telefon uykudan uyanınca bağlantı ölmüş olabilir.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && odaKodu && !ws) baglan();
});

function gonder(mesaj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(mesaj));
    return true;
  }
  bildir("Bağlantı yok, yeniden bağlanıyor…");
  return false;
}

function mesajIsle(mesaj) {
  if (mesaj.t === "hata") {
    if (kilitli) {
      kilitli = false;
      salla();
    }
    return bildir(mesaj.mesaj);
  }
  if (mesaj.t === "bilgi") return bildir(mesaj.mesaj, 3000);
  if (mesaj.t === "durum") ciz(mesaj);
}

// ---------- Çizim ----------

function tahtaKur(kap, satirSayisi, sinif) {
  kap.innerHTML = "";
  for (let s = 0; s < satirSayisi; s++) {
    const satir = document.createElement("div");
    satir.className = sinif;
    for (let h = 0; h < UZUNLUK; h++) satir.appendChild(document.createElement(sinif === "satir" ? "div" : "i"));
    if (sinif === "satir") for (const kare of satir.children) kare.className = "kare";
    kap.appendChild(satir);
  }
}

function yeniOyun(d) {
  oyunAnahtari = d.baslangic;
  cizilenSatir = 0;
  mevcut = "";
  kilitli = false;
  sonucGosterildi = false;
  oncekiBitis = null;
  bekleBildirildi = false;
  rakipBulduBildirildi = false;
  tahtaKur(tahta, d.hak, "satir");
  tahtaKur($("rakip-tahta"), d.hak, "mini-satir");
  klavye.temizle();
  $("sonuc-penceresi").close();
}

function ciz(d) {
  durum = d;
  saatFarki = d.simdi - Date.now();

  if (d.durum === "bekliyor") {
    ekranGoster("bekleme");
    $("alt-baslik").textContent = "";
    $("oda-kodu").textContent = d.kod;
    $("bekleme-mod").textContent = `${MODLAR[d.mod].ad} mod · ${MODLAR[d.mod].aciklama}`;
    $("bekleme-baslik").textContent = d.eslesme ? "Rakip bulundu, bağlanıyor…" : "Rakibini bekliyorsun";
    $("davet-alani").hidden = d.eslesme;
    $("vazgec").hidden = d.eslesme;
    $("davet-adresi").textContent = davetAdresi().replace(/^https?:\/\//, "");
    return;
  }

  if (oyunAnahtari !== d.baslangic) yeniOyun(d);
  ekranGoster("oyun");
  $("alt-baslik").textContent = `${MODLAR[d.mod].ad} · ${MODLAR[d.mod].aciklama}`;

  // Hızlı modda tahmin sonrası saate eklenen süre
  if (oncekiBitis !== null && d.ben.bitis > oncekiBitis) bonusGoster(d.ben.bitis - oncekiBitis);
  oncekiBitis = d.ben.bitis;

  // Rakip
  $("rakip-ad").textContent = d.rakip.ad;
  $("rakip-puan").textContent = `${d.rakip.puan} puan`;
  $("rakip-bagli").classList.toggle("bagli", d.rakip.bagli);
  $("rakip-bagli").title = d.rakip.bagli ? "Bağlı" : "Bağlantısı koptu";
  const miniSatirlar = $("rakip-tahta").children;
  d.rakip.satirlar.forEach((satir, i) => {
    satir.renkler.forEach((renk, h) => (miniSatirlar[i].children[h].dataset.durum = renk));
  });

  // Kendi tahtam: yeni gelen satırlar dönerek açılır.
  const satirlar = d.ben.satirlar;
  for (let i = cizilenSatir; i < satirlar.length; i++) satiriBoya(i, satirlar[i], true);
  if (satirlar.length > cizilenSatir) {
    cizilenSatir = satirlar.length;
    mevcut = "";
    kilitli = false;
  }
  mevcutSatiriCiz();

  const benBuldum = satirlar.some(tamDogru);
  if (d.durum === "oyun" && d.ben.durdu !== null && !bekleBildirildi) {
    bekleBildirildi = true;
    const mesaj = benBuldum
      ? `Buldun! ${d.rakip.ad} ${satirlar.length - 1} ya da daha az tahminde bulamazsa kazanırsın.`
      : satirlar.length >= d.hak
        ? `Hakların bitti, ${d.rakip.ad} hâlâ oynuyor…`
        : `Süren bitti, ${d.rakip.ad} hâlâ oynuyor…`;
    setTimeout(() => bildir(mesaj, 3500), 1600);
  }
  const rakipBuldu = d.rakip.satirlar.findIndex(tamDogru) + 1;
  if (d.durum === "oyun" && rakipBuldu && !benBuldum && !rakipBulduBildirildi) {
    rakipBulduBildirildi = true;
    const hedef = rakipBuldu === 2 ? "ilk tahminde" : `en geç ${rakipBuldu - 1}. tahminde`;
    bildir(`${d.rakip.ad} ${rakipBuldu}. tahminde buldu! Kazanmak için ${hedef} bulmalısın.`, 4000);
  }

  if (d.durum === "bitti") {
    sonucuDoldur(d);
    if (!sonucGosterildi) {
      sonucGosterildi = true;
      const sonSatirKazandi = d.sonuc.kazanan === "ben";
      if (sonSatirKazandi) setTimeout(() => tahta.children[satirlar.length - 1]?.classList.add("kazandi"), 1400);
      setTimeout(() => pencereAc("sonuc-penceresi"), 2200);
    }
  }
  saatiGuncelle();
}

const tamDogru = (satir) => satir.renkler.every((r) => r === "dogru");

function satiriBoya(i, satir, animasyonlu) {
  const kareler = tahta.children[i].children;
  satir.renkler.forEach((renk, h) => {
    const kare = kareler[h];
    kare.textContent = buyuk(satir.kelime[h]);
    kare.classList.add("dolu");
    const boya = () => {
      kare.dataset.durum = renk;
      klavye.boya(satir.kelime[h], renk);
    };
    if (animasyonlu) {
      kare.style.animationDelay = `${h * CEVIRME_ARASI}ms`;
      kare.classList.add("donuyor");
      setTimeout(boya, h * CEVIRME_ARASI + 250);
    } else {
      boya();
    }
  });
}

function mevcutSatiriCiz() {
  const satir = tahta.children[cizilenSatir];
  if (!satir) return;
  for (let h = 0; h < UZUNLUK; h++) {
    const harf = [...mevcut][h] || "";
    satir.children[h].textContent = buyuk(harf);
    satir.children[h].classList.toggle("dolu", Boolean(harf));
  }
}

function salla() {
  const satir = tahta.children[cizilenSatir];
  if (!satir) return;
  satir.classList.remove("salla");
  void satir.offsetWidth;
  satir.classList.add("salla");
}

function sunucuSaati() {
  return Date.now() + saatFarki;
}

function saatiGuncelle() {
  const ortu = $("geri-sayim-ortu");
  if (!durum || durum.durum === "bekliyor") return;
  const simdi = sunucuSaati();
  const baslamadi = durum.durum === "oyun" && simdi < durum.baslangic;
  ortu.hidden = !baslamadi;
  if (baslamadi) $("geri-sayim-sayi").textContent = Math.ceil((durum.baslangic - simdi) / 1000);

  const ben = kalanSure(durum.ben, simdi);
  const saat = $("saat");
  saat.textContent = sureYazisi(ben);
  saat.classList.toggle("az", durum.ben.durdu === null && ben <= 30);
  saat.classList.toggle("durdu", durum.ben.durdu !== null);

  const rakip = kalanSure(durum.rakip, simdi);
  $("rakip-saat").textContent = durum.rakip.durdu !== null && rakip > 0 ? "bitirdi" : sureYazisi(rakip);
}

// Saniye cinsinden kalan süre. Oynamayı bitiren oyuncunun saati durur.
function kalanSure(oyuncu, simdi) {
  const an = oyuncu.durdu ?? Math.max(simdi, durum.baslangic);
  return Math.max(0, (oyuncu.bitis - an) / 1000);
}

function sureYazisi(saniye) {
  const s = Math.ceil(saniye);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function bonusGoster(ms) {
  const el = document.createElement("span");
  el.className = "bonus";
  el.textContent = `+${Math.round(ms / 1000)} sn`;
  // Harfler döndükten sonra görünsün.
  setTimeout(() => {
    $("saat-kutusu").appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }, 1500);
}
setInterval(saatiGuncelle, 200);

// ---------- Tahmin ----------

function oynayabilir() {
  if (!durum || durum.durum !== "oyun" || kilitli) return false;
  const simdi = sunucuSaati();
  if (simdi < durum.baslangic || simdi >= durum.ben.bitis || durum.ben.durdu !== null) return false;
  const satirlar = durum.ben.satirlar;
  return satirlar.length < durum.hak && !satirlar.some(tamDogru);
}

function tusaBasildi(tus) {
  if (!oynayabilir()) return;
  if (tus === "gir") return tahminEt();
  const harfler = [...mevcut];
  if (tus === "sil") {
    harfler.pop();
  } else if (harfler.length < UZUNLUK) {
    harfler.push(tus);
    const kare = tahta.children[cizilenSatir].children[harfler.length - 1];
    kare.classList.remove("zipla");
    void kare.offsetWidth;
    kare.classList.add("zipla");
  }
  mevcut = harfler.join("");
  mevcutSatiriCiz();
}

function tahminEt() {
  if ([...mevcut].length < UZUNLUK) {
    salla();
    return bildir("Harf sayısı yetersiz");
  }
  if (!GECERLI.has(mevcut)) {
    salla();
    return bildir("Sözlükte yok");
  }
  if (gonder({ t: "tahmin", kelime: mevcut })) kilitli = true;
}

// ---------- Sonuç ----------

function sonucuDoldur(d) {
  const { kazanan, cevap, puan } = d.sonuc;
  $("sonuc-baslik").textContent = kazanan === "ben" ? "Kazandın! 🎉" : kazanan === "rakip" ? `${d.rakip.ad} kazandı` : "Berabere";
  const kelime = $("sonuc-kelime");
  kelime.textContent = buyuk(cevap);
  kelime.href = `https://sozluk.gov.tr/?kelime=${encodeURIComponent(cevap)}`;
  $("sonuc-aciklama").textContent = sonucAciklamasi(d);

  const degisim = $("puan-degisimi");
  if (puan) {
    const fark = puan.yeni - puan.eski;
    degisim.innerHTML = `${MODLAR[d.mod].ad} puanın: ${puan.eski} → <strong>${puan.yeni}</strong> <span class="${fark >= 0 ? "artti" : "azaldi"}">(${fark >= 0 ? "+" : ""}${fark})</span>`;
  } else {
    degisim.textContent = "";
  }

  const kap = $("rakip-sonuc");
  kap.innerHTML = "";
  if (!d.rakip.satirlar.length) kap.innerHTML = `<p class="soluk-yazi">Hiç tahmin yapmadı.</p>`;
  for (const satir of d.rakip.satirlar) {
    const el = document.createElement("div");
    el.className = "satir kucuk-satir";
    satir.renkler.forEach((renk, h) => {
      const kare = document.createElement("div");
      kare.className = "kare";
      kare.dataset.durum = renk;
      kare.textContent = buyuk(satir.kelime[h]);
      el.appendChild(kare);
    });
    kap.appendChild(el);
  }

  const rovans = $("rovans");
  const rovansDurumu = $("rovans-durumu");
  rovans.disabled = d.rovans.ben || !d.rakip.bagli || d.engelli;
  rovans.textContent = d.rovans.ben ? "Rakip bekleniyor…" : "Rövanş";
  rovansDurumu.hidden = !(d.rovans.rakip || !d.rakip.bagli) || d.engelli;
  rovansDurumu.textContent = !d.rakip.bagli ? `${d.rakip.ad} oyundan ayrıldı.` : `${d.rakip.ad} rövanş istiyor!`;
}

// Kazananın neden kazandığı: tahmin sayısı ya da süre.
function sonucAciklamasi(d) {
  const ben = d.ben.satirlar.findIndex(tamDogru) + 1;
  const rakip = d.rakip.satirlar.findIndex(tamDogru) + 1;
  const ad = d.rakip.ad;
  if (!ben && !rakip) return "İkiniz de bulamadınız.";
  if (ben && !rakip) return `Sen ${ben} tahminde buldun, ${ad} bulamadı.`;
  if (!ben && rakip) return `${ad} ${rakip} tahminde buldu, sen bulamadın.`;
  if (ben !== rakip) return `Sen ${ben}, ${ad} ${rakip} tahminde buldu.`;
  const fark = Math.max(1, Math.round(Math.abs(d.sonuc.benSure - d.sonuc.rakipSure) / 1000));
  return d.sonuc.kazanan === "ben"
    ? `İkiniz de ${ben} tahminde buldunuz, sen ${fark} saniye daha hızlıydın.`
    : `İkiniz de ${ben} tahminde buldunuz, ${ad} ${fark} saniye daha hızlıydı.`;
}

function sonucMetni() {
  const d = durum;
  const satirlar = d.ben.satirlar.map((s) => s.renkler.map((r) => EMOJI[r]).join(""));
  const baslik =
    d.sonuc.kazanan === "ben"
      ? `${d.rakip.ad} karşısında ${d.ben.satirlar.findIndex(tamDogru) + 1} tahminde bulup kazandım! 🏆`
      : d.sonuc.kazanan === "rakip"
        ? `${d.rakip.ad} bu sefer beni geçti.`
        : `${d.rakip.ad} ile berabere kaldık.`;
  return `Harfoni Düello ⚔️ ${MODLAR[d.mod].ad}\n${baslik}\n\n${satirlar.join("\n")}\n\nSen de meydan oku: ${DUELLO_ADRESI}`;
}

// ---------- Şikâyet ve engelleme ----------

function rakipMenusunuAc() {
  if (!durum?.rakip) return;
  $("rakip-pencere-ad").textContent = durum.rakip.ad;
  $("engelle").disabled = durum.engelli;
  $("engelle").textContent = durum.engelli ? "Engellendi" : "Engelle";
  for (const dugme of document.querySelectorAll("[data-sebep]")) dugme.disabled = false;
  pencereAc("rakip-penceresi");
}

async function engelleriGoster() {
  const kap = $("engel-listesi");
  let liste;
  try {
    liste = await istek("/oyuncu/engeller", kimlik);
  } catch {
    return;
  }
  kap.innerHTML = liste.length ? "" : `<p class="soluk-yazi">Kimseyi engellemedin.</p>`;
  for (const kisi of liste) {
    const satir = document.createElement("div");
    satir.className = "engel-satiri";
    const ad = document.createElement("span");
    ad.textContent = kisi.ad;
    const dugme = document.createElement("button");
    dugme.className = "duz-dugme";
    dugme.type = "button";
    dugme.textContent = "Engeli kaldır";
    dugme.addEventListener("click", async () => {
      await istek("/oyuncu/engel-kaldir", { ...kimlik, no: kisi.no }).catch(() => {});
      engelleriGoster();
    });
    satir.append(ad, dugme);
    kap.appendChild(satir);
  }
}

// ---------- Başlangıç ----------

async function basla() {
  pencereleriBagla();
  kimlik = kimlikAl();
  odaKodu = parametreler.get("oda")?.toUpperCase() || null;

  $("ad-formu").addEventListener("submit", async (olay) => {
    olay.preventDefault();
    try {
      await adKaydet($("ad-girisi").value);
      if (odaKodu) baglan();
      else ekranGoster("lobi");
    } catch (hata) {
      bildir(hata.message, 3000);
    }
  });
  $("profil-formu").addEventListener("submit", async (olay) => {
    olay.preventDefault();
    try {
      await adKaydet($("profil-ad").value);
      bildir("Kaydedildi");
    } catch (hata) {
      bildir(hata.message, 3000);
    }
  });
  $("rakip-menu").addEventListener("click", rakipMenusunuAc);
  $("sonuc-rakip-menu").addEventListener("click", rakipMenusunuAc);
  for (const dugme of document.querySelectorAll("[data-sebep]")) {
    dugme.addEventListener("click", () => {
      if (!gonder({ t: "sikayet", sebep: dugme.dataset.sebep })) return;
      for (const d of document.querySelectorAll("[data-sebep]")) d.disabled = true;
      $("rakip-penceresi").close();
    });
  }
  $("engelle").addEventListener("click", () => {
    if (!confirm(`${durum.rakip.ad} engellensin mi? Bir daha eşleşmeyeceksiniz.`)) return;
    if (gonder({ t: "engelle" })) $("rakip-penceresi").close();
  });
  $("profil-ac").addEventListener("click", () => {
    profilYenile();
    engelleriGoster();
    pencereAc("profil-penceresi");
  });
  $("profil-sil").addEventListener("click", async () => {
    if (!confirm("Profilin, puanın ve maç geçmişin kalıcı olarak silinecek. Emin misin?")) return;
    try {
      await istek("/oyuncu/sil", kimlik);
      baglantiyiKapat();
      yaz(KIMLIK_ANAHTARI, null);
      yaz(KIMLIK_ANAHTARI + ".ad", null);
      location.href = location.pathname;
    } catch (hata) {
      bildir(hata.message, 3000);
    }
  });
  for (const dugme of document.querySelectorAll("[data-mod]")) {
    dugme.addEventListener("click", () => modSec(dugme.dataset.mod));
  }
  modSec(MODLAR[secilenMod] ? secilenMod : "hizli");
  $("rakip-bul").addEventListener("click", rakipAra);
  $("davet-et").addEventListener("click", () => davetEt($("davet-et")));
  $("aramadan-davet").addEventListener("click", () => davetEt($("aramadan-davet")));
  $("arama-iptal").addEventListener("click", () => lobiyeDon());
  $("davet-paylas").addEventListener("click", davetiPaylas);
  $("vazgec").addEventListener("click", () => lobiyeDon());
  $("rovans").addEventListener("click", () => gonder({ t: "rovans" }));
  $("yeni-mac").addEventListener("click", () => {
    const mod = durum?.mod || secilenMod;
    lobiyeDon();
    modSec(mod);
    rakipAra();
  });
  $("sonuc-paylas").addEventListener("click", () => paylas(sonucMetni()));

  if (!oku("duello.yardim-goruldu", false)) {
    pencereAc("yardim-penceresi");
    yaz("duello.yardim-goruldu", true);
  }

  // Daha önce ad seçtiyse sunucudan profilini al.
  if (oku(KIMLIK_ANAHTARI + ".ad", null)) {
    try {
      profil = await istek("/oyuncu/bilgi", kimlik);
    } catch (hata) {
      if (hata.durum === 0) {
        ekranGoster("yukleniyor");
        document.querySelector("#ekran-yukleniyor p").textContent = hata.message;
        return;
      }
      profil = null; // sunucuda yok (silinmiş): yeniden ad seçsin
    }
  }
  profiliGoster();

  if (!profil) {
    $("ad-girisi").value = oku(KIMLIK_ANAHTARI + ".ad", "") || "";
    return ekranGoster("ad");
  }
  if (odaKodu) baglan();
  else ekranGoster("lobi");
}

basla();
