// Sefer içindeki her rastgele karar kendi etiketinden türetilen bir üreteçle
// verilir ("harita", "kelime|2-0|1" gibi). Böylece aynı tohum aynı seferi verir
// ve kayıttan devam ederken üretecin durumunu saklamak gerekmez.

import { rastgeleUretec } from "../ortak/rastgele.js";

export function zar(tohum, ...etiketler) {
  let h = (2166136261 ^ tohum) >>> 0;
  for (const harf of etiketler.join("|")) {
    h ^= harf.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return rastgeleUretec(h >>> 0);
}

export const sec = (r, liste) => liste[Math.floor(r() * liste.length)];

export function karistir(r, liste) {
  const kopya = [...liste];
  for (let i = kopya.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
  }
  return kopya;
}

// agirliklar: { secenek: ağırlık }
export function agirlikliSec(r, agirliklar) {
  const toplam = Object.values(agirliklar).reduce((a, b) => a + b, 0);
  let kalan = r() * toplam;
  for (const [secenek, agirlik] of Object.entries(agirliklar)) {
    kalan -= agirlik;
    if (kalan < 0) return secenek;
  }
  return Object.keys(agirliklar).at(-1);
}
