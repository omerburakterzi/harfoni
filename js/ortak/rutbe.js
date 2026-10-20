// Düello rütbeleri: Elo puanına göre. Herkes 1000 puanla Çırak başlar.

export const RUTBELER = [
  { ad: "Acemi", simge: "🌱", alt: -Infinity },
  { ad: "Çırak", simge: "✏️", alt: 950 },
  { ad: "Usta", simge: "📘", alt: 1100 },
  { ad: "Üstat", simge: "🎓", alt: 1250 },
  { ad: "Efsane", simge: "👑", alt: 1400 },
];

// { ad, simge, sonraki, kalan (sonraki rütbeye puan), ilerleme (0-1) }
export function rutbe(puan) {
  let i = RUTBELER.length - 1;
  while (i > 0 && puan < RUTBELER[i].alt) i--;
  const simdiki = RUTBELER[i];
  const sonraki = RUTBELER[i + 1] || null;
  const alt = Number.isFinite(simdiki.alt) ? simdiki.alt : 800;
  return {
    ...simdiki,
    sira: i,
    sonraki,
    kalan: sonraki ? sonraki.alt - puan : 0,
    ilerleme: sonraki ? Math.max(0, Math.min(1, (puan - alt) / (sonraki.alt - alt))) : 1,
  };
}

export const rutbeYazisi = (puan) => {
  const r = rutbe(puan);
  return `${r.simge} ${r.ad}`;
};
