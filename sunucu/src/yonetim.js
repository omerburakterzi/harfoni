// Şikâyetleri incelemek için küçük yönetim sayfası: https://api.harfoni.com/yonetim
// Giriş anahtarı Cloudflare'de gizli ayar olarak durur (YONETIM_ANAHTARI).

export function yetkiliMi(istek, env) {
  const beklenen = env.YONETIM_ANAHTARI;
  const gelen = (istek.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!beklenen || gelen.length !== beklenen.length) return false;
  let fark = 0;
  for (let i = 0; i < beklenen.length; i++) fark |= beklenen.charCodeAt(i) ^ gelen.charCodeAt(i);
  return fark === 0;
}

export const YONETIM_SAYFASI = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Harfoni Yönetim</title>
<style>
  :root { --zemin:#f7f6f2; --yuzey:#fff; --yazi:#1d1f23; --soluk:#6b6f76; --cizgi:#d6d5cf; --dogru:#14988f; --kirmizi:#d64545; }
  @media (prefers-color-scheme: dark) { :root { --zemin:#121417; --yuzey:#1c1f24; --yazi:#eef0f2; --soluk:#9a9ea6; --cizgi:#34383f; } }
  body { margin:0; background:var(--zemin); color:var(--yazi); font:15px/1.5 system-ui, sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px; }
  h1 { margin:0 0 16px; font-size:1.5rem; }
  .kart { background:var(--yuzey); border:1px solid var(--cizgi); border-radius:10px; padding:14px 16px; margin-bottom:10px; }
  .kart strong { font-size:1.05rem; }
  .soluk { color:var(--soluk); font-size:.85rem; }
  .dugmeler { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  button, input { font:inherit; }
  button { padding:7px 14px; border-radius:999px; border:1px solid var(--cizgi); background:var(--yuzey); color:var(--yazi); cursor:pointer; }
  button.ana { background:var(--dogru); border-color:var(--dogru); color:#fff; }
  button.tehlike { color:var(--kirmizi); border-color:var(--kirmizi); }
  input { padding:8px 12px; border:1px solid var(--cizgi); border-radius:8px; background:var(--yuzey); color:var(--yazi); width:100%; max-width:360px; }
  .sekmeler { display:flex; gap:8px; margin-bottom:16px; }
  .toplamlar { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; margin-bottom:12px; }
  .toplamlar div { background:var(--yuzey); border:1px solid var(--cizgi); border-radius:10px; padding:10px 12px; }
  .toplamlar strong { display:block; font-size:1.4rem; }
  .toplamlar span { color:var(--soluk); font-size:.8rem; }
  .tablo-kap { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; font-size:.88rem; font-variant-numeric:tabular-nums; }
  th, td { padding:6px 8px; border-bottom:1px solid var(--cizgi); text-align:right; white-space:nowrap; }
  th:first-child, td:first-child { text-align:left; }
  th { color:var(--soluk); font-weight:600; }
  .etiket { display:inline-block; padding:1px 8px; border-radius:999px; background:var(--kirmizi); color:#fff; font-size:.75rem; margin-left:6px; }
</style>
</head>
<body>
<main>
  <h1>Harfoni · Yönetim</h1>
  <nav class="sekmeler"><button id="sekme-istatistik" class="ana">İstatistikler</button><button id="sekme-sikayet">Şikâyetler</button><button id="sekme-oyuncu">Oyuncular</button></nav>
  <section id="oyuncular" hidden>
    <form id="ara-formu" class="dugmeler"><input id="ara" type="search" placeholder="Takma adın bir kısmını yaz"><button class="ana">Ara</button></form>
    <div id="sonuclar"></div>
  </section>
  <section id="istatistik" hidden>
    <div id="toplamlar" class="toplamlar"></div>
    <p class="soluk">Sadece takma adı olan oyuncuların bitirdiği günlük oyunlar sayılır; gerçek oynanma bunun üstündedir. Düello: puanlı maçlar (bot ve puansız hariç).</p>
    <div class="tablo-kap"><table id="gunler"></table></div>
  </section>
  <form id="giris" hidden>
    <p>Yönetim anahtarını gir (bilgisayarındaki <code>Harfoni-Anahtarlar/yonetim-anahtari.txt</code> dosyasında).</p>
    <input id="anahtar" type="password" autocomplete="current-password">
    <div class="dugmeler"><button class="ana">Giriş</button></div>
  </form>
  <div id="liste" hidden></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
let anahtar = localStorage.getItem("yonetim-anahtari") || "";
const SEBEP = { ad: "Uygunsuz takma ad", hile: "Hile", diger: "Başka bir sorun" };
const kacis = (m) => String(m).replace(/[&<>"]/g, (k) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[k]);

async function api(yol, govde) {
  const y = await fetch(yol, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + anahtar }, body: JSON.stringify(govde || {}) });
  if (y.status === 401) { localStorage.removeItem("yonetim-anahtari"); anahtar = ""; $("giris").hidden = false; $("liste").innerHTML = ""; throw new Error("yetki"); }
  return y.json();
}

async function yukle() {
  const liste = await api("/yonetim/liste");
  // Aynı kişiye gelen şikâyetleri tek kartta topla.
  const kisiler = new Map();
  for (const s of liste) {
    if (!kisiler.has(s.hedef)) kisiler.set(s.hedef, { ...s, sebepler: [] });
    kisiler.get(s.hedef).sebepler.push(SEBEP[s.sebep] + " · " + new Date(s.zaman).toLocaleString("tr-TR"));
  }
  $("liste").innerHTML = kisiler.size ? "" : '<p class="soluk">Açık şikâyet yok. 🎉</p>';
  for (const k of kisiler.values()) {
    const kart = document.createElement("div");
    kart.className = "kart";
    kart.innerHTML = '<strong>' + kacis(k.guncel_ad ?? k.hedef_ad + " (silinmiş)") + '</strong>' +
      (k.yasakli ? '<span class="etiket">Uzaklaştırıldı</span>' : "") +
      '<div class="soluk">' + k.acik_sayi + ' açık şikâyet</div>' +
      '<ul>' + k.sebepler.map((s) => "<li>" + kacis(s) + "</li>").join("") + '</ul>' +
      '<div class="dugmeler">' +
        '<button data-islem="ad-sifirla">Adını sıfırla</button>' +
        (k.yasakli ? '<button data-islem="yasak-kaldir">Uzaklaştırmayı kaldır</button>' : '<button class="tehlike" data-islem="yasakla">Düello\\'dan uzaklaştır</button>') +
        '<button class="ana" data-islem="kapat">Tamam, kapat</button>' +
      '</div>';
    for (const b of kart.querySelectorAll("button")) b.onclick = async () => {
      if (b.dataset.islem === "yasakla" && !confirm("Bu oyuncu Düello oynayamayacak. Emin misin?")) return;
      await api("/yonetim/islem", { islem: b.dataset.islem, hedef: k.hedef });
      yukle();
    };
    $("liste").appendChild(kart);
  }
}

async function istatistikYukle() {
  const v = await api("/yonetim/istatistik");
  const t = v.toplam;
  const kutu = (deger, ad) => '<div><strong>' + deger + '</strong><span>' + ad + '</span></div>';
  $("toplamlar").innerHTML = kutu(t.oyuncu, "takma adlı oyuncu") + kutu(t.hesapBagli, "Google/Apple bağlı") + kutu(t.gunlukSonuc, "bitirilen günlük oyun") +
    kutu(t.duelloMaci, "puanlı Düello maçı") + kutu(t.grup, "grup") + kutu(t.grupUyeligi, "grup üyeliği");
  const basliklar = ["Tarih", "Kişi", "Klasik", "Palavra", "Arada", "Muamma", "4'ü de", "Düello", "Yeni oyuncu"];
  $("gunler").innerHTML = "<tr>" + basliklar.map((b) => "<th>" + b + "</th>").join("") + "</tr>" +
    v.gunler.map((g) => "<tr><td>" + g.tarih.slice(8, 10) + "." + g.tarih.slice(5, 7) + "</td><td>" + [g.kisi, g.klasik, g.palavra, g.arada, g.muamma, g.dordu, g.duello, g.yeniOyuncu].join("</td><td>") + "</td></tr>").join("");
}

async function oyuncuAra() {
  const liste = await api("/yonetim/ara", { ad: $("ara").value });
  $("sonuclar").innerHTML = liste.length ? "" : '<p class="soluk">Bulunamadı.</p>';
  for (const o of liste) {
    const kart = document.createElement("div");
    kart.className = "kart";
    kart.innerHTML = '<strong>' + kacis(o.ad) + '</strong>' + (o.yasakli ? '<span class="etiket">Uzaklaştırıldı</span>' : "") +
      '<div class="soluk">Hızlı ' + o.puanlar.hizli + ' · Uzun ' + o.puanlar.uzun + ' · kayıt ' + new Date(o.olusturma).toLocaleDateString("tr-TR") + '</div>' +
      '<div class="dugmeler"><button data-islem="ad-sifirla">Adını sıfırla</button>' +
      (o.yasakli ? '<button data-islem="yasak-kaldir">Uzaklaştırmayı kaldır</button>' : '<button class="tehlike" data-islem="yasakla">Uzaklaştır</button>') + '</div>';
    for (const b of kart.querySelectorAll("button")) b.onclick = async () => {
      if (b.dataset.islem === "yasakla" && !confirm(o.ad + " Düello ve sıralamalardan uzaklaştırılsın mı?")) return;
      await api("/yonetim/islem", { islem: b.dataset.islem, hedef: o.id });
      oyuncuAra();
    };
    $("sonuclar").appendChild(kart);
  }
}
$("ara-formu").onsubmit = (e) => { e.preventDefault(); oyuncuAra().catch(() => {}); };

function sekme(ad) {
  $("istatistik").hidden = ad !== "istatistik";
  $("liste").hidden = ad !== "sikayet";
  $("oyuncular").hidden = ad !== "oyuncu";
  $("sekme-istatistik").className = ad === "istatistik" ? "ana" : "";
  $("sekme-sikayet").className = ad === "sikayet" ? "ana" : "";
  $("sekme-oyuncu").className = ad === "oyuncu" ? "ana" : "";
  if (ad === "istatistik") istatistikYukle().catch(() => {});
  if (ad === "sikayet") yukle().catch(() => {});
  if (ad === "oyuncu") $("ara").focus();
}
$("sekme-istatistik").onclick = () => sekme("istatistik");
$("sekme-sikayet").onclick = () => sekme("sikayet");
$("sekme-oyuncu").onclick = () => sekme("oyuncu");

$("giris").onsubmit = (e) => {
  e.preventDefault();
  anahtar = $("anahtar").value.trim();
  localStorage.setItem("yonetim-anahtari", anahtar);
  $("giris").hidden = true;
  sekme("istatistik");
};
if (anahtar) sekme("istatistik"); else $("giris").hidden = false;
</script>
</body>
</html>`;
