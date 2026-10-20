import { oku, yaz } from "./depo.js";

// Her oyunun kendi istatistiği olur: oynanan, kazanılan, seri ve
// kaçıncı tahminde bulunduğunun dağılımı.
export function istatistikOku(oyun, hakSayisi) {
  const ist = oku(`${oyun}.istatistik`, {
    oynanan: 0,
    kazanilan: 0,
    seri: 0,
    enUzunSeri: 0,
    dagilim: Array(hakSayisi).fill(0),
    sonGun: null,
  });
  // Hak sayısı azaldıysa (Arada 18 → 15) fazla satırlar son satıra eklenir.
  if (ist.dagilim.length > hakSayisi) {
    const fazla = ist.dagilim.splice(hakSayisi).reduce((a, b) => a + b, 0);
    ist.dagilim[hakSayisi - 1] += fazla;
  }
  while (ist.dagilim.length < hakSayisi) ist.dagilim.push(0);
  return ist;
}

export function sonucKaydet(oyun, hakSayisi, gun, kazandi, tahminSayisi) {
  const ist = istatistikOku(oyun, hakSayisi);
  if (ist.sonGun === gun) return ist;

  const seriDevam = ist.sonGun === gun - 1;
  ist.oynanan += 1;
  if (kazandi) {
    ist.kazanilan += 1;
    ist.seri = seriDevam ? ist.seri + 1 : 1;
    ist.enUzunSeri = Math.max(ist.enUzunSeri, ist.seri);
    ist.dagilim[tahminSayisi - 1] += 1;
  } else {
    ist.seri = 0;
  }
  ist.sonGun = gun;
  yaz(`${oyun}.istatistik`, ist);
  return ist;
}

// Dün oynanmadıysa seri bozulmuş demektir.
export function guncelSeri(ist, bugun) {
  return ist.sonGun === bugun || ist.sonGun === bugun - 1 ? ist.seri : 0;
}
