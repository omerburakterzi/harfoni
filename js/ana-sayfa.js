// Ana sayfadaki "Harfoni Puanı" kutusu: bu haftaki sıra ve seri.
// Profil yoksa sıralamaya nasıl katılınacağını söyler.

import { kimlik, siralamayiAc } from "./ortak/siralama.js";
import { istek } from "./ortak/sunucu.js";

const kutu = document.getElementById("puan-kutusu");
const baslik = document.getElementById("pk-baslik");
const alt = document.getElementById("pk-alt");
const seri = document.getElementById("pk-seri");

async function goster() {
  const k = kimlik();
  if (!k) {
    baslik.textContent = "Sıralamaya gir";
    alt.textContent = "Günlük oyunlardan puan topla. Düello'da takma ad seçmen yeterli.";
    seri.textContent = "🏆";
    kutu.onclick = () => (location.href = "duello.html");
    kutu.hidden = false;
    return;
  }
  let veri;
  try {
    veri = await istek("/ozet", k);
  } catch {
    return; // internet yoksa kutu görünmez
  }
  if (veri.hafta) {
    baslik.textContent = `Bu hafta ${veri.hafta.sira}. sıradasın`;
    alt.textContent = `${veri.hafta.puan} puan · ${veri.toplam} kişi arasında ilk %${veri.hafta.yuzde}`;
  } else {
    baslik.textContent = "Bu hafta henüz puanın yok";
    alt.textContent = "Bugünün bulmacalarını çöz, sıralamaya gir.";
  }
  seri.textContent = veri.seri ? `🔥 ${veri.seri}` : "🏆";
  seri.title = veri.seri ? `${veri.seri} günlük seri` : "";
  kutu.onclick = () => siralamayiAc("hafta", "hepsi");
  kutu.hidden = false;
}

goster();
