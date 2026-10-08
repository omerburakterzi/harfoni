import { buyuk, kucuk, harfMi } from "./turkce.js";

// Tam Türkçe Q klavye düzeni. Türkçede olmayan Q, W ve X de yerinde duruyor
// (soluk ve basılamaz), böylece tuşlar telefon klavyesindeki yerlerinde.
// Onay tuşu telefon klavyelerindeki gibi sağda.
const SATIRLAR = [
  ["q", "w", "e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"],
  ["sil", "z", "x", "c", "v", "b", "n", "m", "ö", "ç", "gir"],
];
const PASIF = new Set(["q", "w", "x"]);

// Bir tuş daha bilgilendirici bir renk aldıysa daha az bilgilendiricisine dönmez.
// İki ihtimalli durumlar (Palavra'da yalan denen kareler) kesin renklerden
// önce gelir: kesin bilgi her zaman öne geçer.
const ONCELIK = { "var-yok": 1, "dogru-yok": 2, "dogru-var": 3, yok: 4, var: 5, dogru: 6 };

const SIL_IKONU =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"/></svg>';

export function klavyeKur(kap, tusaBasildi) {
  const tuslar = {};
  kap.innerHTML = "";

  for (const satir of SATIRLAR) {
    const satirEl = document.createElement("div");
    satirEl.className = "klavye-satir";
    for (const tus of satir) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tus";
      btn.dataset.tus = tus;
      if (PASIF.has(tus)) {
        btn.textContent = buyuk(tus);
        btn.classList.add("pasif");
        btn.disabled = true;
        btn.setAttribute("aria-hidden", "true");
        satirEl.appendChild(btn);
        continue;
      }
      if (tus === "gir") {
        btn.textContent = "GİR";
        btn.classList.add("genis", "gir");
        btn.setAttribute("aria-label", "Tahmini gönder");
      } else if (tus === "sil") {
        btn.innerHTML = SIL_IKONU;
        btn.classList.add("genis");
        btn.setAttribute("aria-label", "Harf sil");
      } else {
        btn.textContent = buyuk(tus);
        tuslar[tus] = btn;
      }
      btn.addEventListener("click", () => {
        tusaBasildi(tus);
        btn.blur();
      });
      satirEl.appendChild(btn);
    }
    kap.appendChild(satirEl);
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return; // yazı kutuları (ör. takma ad)
    if (e.key === "Enter") {
      e.preventDefault();
      tusaBasildi("gir");
    } else if (e.key === "Backspace") {
      tusaBasildi("sil");
    } else {
      const harf = kucuk(e.key);
      if (harfMi(harf)) tusaBasildi(harf);
    }
  });

  return {
    boya(harf, durum) {
      const btn = tuslar[harf];
      if (!btn) return;
      const eski = btn.dataset.durum;
      if (!eski || ONCELIK[durum] > ONCELIK[eski]) btn.dataset.durum = durum;
    },
    temizle() {
      for (const btn of Object.values(tuslar)) delete btn.dataset.durum;
    },
  };
}
