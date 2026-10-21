// Puanlama: bulmaca puanı = taş × çarpan × tılsım katları.
// Her tahminde yeşil harf 10, sarı harf 4 taş; çözülünce çarpan 1 + kalan hak.
// Tılsımların katkısı ayrı satırlar olarak döner ki ekranda tek tek gösterilsin.

import { degerlendir } from "../ortak/degerlendir.js";
import { ODUL } from "./veri.js";

const SESLILER = new Set("aeıioöuü");
const NOKTALILAR = new Set("çğiöşü");

const topla = (ekler) => ekler.reduce((a, e) => a + e.deger, 0);

/**
 * Şimdiye kadarki tahminlerin taşı. Bulmaca bitmeden de çağrılır (canlı sayaç).
 * b: { cevap, tahminler, arada, fener: [açılan yerler], kurabiye }
 * Döner: { taban, aciklama, ekler: [{ id, deger }], kurabiye, toplam }
 */
export function tasHesapla(b, tilsimlar) {
  const sahip = (id) => tilsimlar.includes(id);
  // Çözen tahmin her zaman sonuncusudur; ondan öncekiler keşif tahminleri.
  const onceki = b.tahminler.filter((t) => t !== b.cevap);
  const cozuldu = onceki.length < b.tahminler.length;
  const ekler = [];
  let taban;
  let aciklama;

  if (b.arada) {
    // Arada'da renk yok: her yanlış tahmin bir sarı, bulan tahmin bütün harfler yeşil sayılır.
    const yanlis = onceki.length;
    const yesil = cozuldu ? b.cevap.length : 0;
    taban = yanlis * 4 + yesil * 10;
    aciklama = yesil ? `${yanlis} tahmin × 4 + ${yesil} yeşil × 10` : `${yanlis} tahmin × 4`;
    if (sahip("cifte") && yesil) ekler.push({ id: "cifte", deger: yesil * 5 });
    if (sahip("cizmeli") && yanlis) ekler.push({ id: "cizmeli", deger: yanlis * 4 });
  } else {
    const fener = new Set(b.fener || []);
    let yesil = 0;
    let sari = 0;
    for (const t of b.tahminler) {
      degerlendir(t, b.cevap).forEach((d, j) => {
        if (d === "dogru" && !fener.has(j)) yesil++;
        else if (d === "var") sari++;
      });
    }
    taban = yesil * 10 + sari * 4;
    aciklama = `${yesil} yeşil × 10 + ${sari} sarı × 4`;
    if (sahip("cifte") && yesil) ekler.push({ id: "cifte", deger: yesil * 5 });
    if (sahip("cizmeli") && sari) ekler.push({ id: "cizmeli", deger: sari * 4 });
    if (sahip("kedi")) {
      const bulunan = new Set();
      for (const t of onceki) {
        degerlendir(t, b.cevap).forEach((d, j) => {
          if (d !== "yok") bulunan.add(t[j]);
        });
      }
      if (bulunan.size) ekler.push({ id: "kedi", deger: bulunan.size * 6 });
    }
  }
  if (sahip("yumusak")) {
    const adet = b.tahminler.filter((t) => t.includes("ğ")).length;
    if (adet) ekler.push({ id: "yumusak", deger: adet * 40 });
  }
  const toplam = (taban + topla(ekler)) * (b.kurabiye ? 2 : 1);
  return { taban, aciklama, ekler, kurabiye: Boolean(b.kurabiye), toplam };
}

/**
 * Çözülmüş bulmacanın puanı.
 * b: tasHesapla'daki alanlar + hak
 * tespih: Tespih sayacı (bu bulmaca dahil)
 */
export function puanHesapla(b, tilsimlar, tespih = 0) {
  const sahip = (id) => tilsimlar.includes(id);
  const tas = tasHesapla(b, tilsimlar);
  const kalan = b.hak - b.tahminler.length;

  const ekler = [];
  if (sahip("pusula") && !b.arada) {
    const yerler = new Set();
    for (const t of b.tahminler.slice(0, -1)) {
      degerlendir(t, b.cevap).forEach((d, j) => {
        if (d === "dogru" && SESLILER.has(t[j])) yerler.add(j);
      });
    }
    if (yerler.size) ekler.push({ id: "pusula", deger: yerler.size });
  }
  if (sahip("noktali")) {
    const adet = [...b.cevap].filter((h) => NOKTALILAR.has(h)).length;
    if (adet) ekler.push({ id: "noktali", deger: adet });
  }
  if (sahip("tespih") && tespih) ekler.push({ id: "tespih", deger: tespih });
  const carpan = { kalan, taban: 1 + kalan, ekler, toplam: 1 + kalan + topla(ekler) };

  const katlar = [];
  if (sahip("ilkgorus") && !b.arada) {
    const yesil = degerlendir(b.tahminler[0], b.cevap).filter((d) => d === "dogru").length;
    if (yesil >= 2) katlar.push({ id: "ilkgorus", deger: 2 });
  }
  if (sahip("tezcanli") && b.tahminler.length <= 2) katlar.push({ id: "tezcanli", deger: 3 });
  if (sahip("altinkalem")) katlar.push({ id: "altinkalem", deger: 1.5 });
  const kat = katlar.reduce((a, k) => a * k.deger, 1);

  return { tas, carpan, katlar, kat, puan: Math.round(tas.toplam * carpan.toplam * kat) };
}

export function faizHesapla(eldeki, tilsimlar) {
  const sinir = tilsimlar.includes("kumbara") ? ODUL.kumbaraSiniri : ODUL.faizSiniri;
  return Math.min(sinir, Math.floor(eldeki / ODUL.faizBolen));
}

/**
 * Bulmaca sonunda gelen mürekkep. eldeki: ödülden önceki mürekkep (faiz buna göre).
 * Döner: { satirlar: [{ ad?, id?, deger }], toplam }
 */
export function murekkepHesapla({ tur, kalan, tilsimlar, eldeki }) {
  const satirlar = [];
  let odul;
  if (tur === "miniboss" || tur === "bekci") {
    odul = ODUL[tur];
    satirlar.push({ ad: tur === "bekci" ? "Bekçi ödülü" : "Mini boss ödülü", deger: odul });
  } else {
    odul = 3 + kalan;
    satirlar.push({ ad: `Ödül: 3 + ${kalan} kalan hak`, deger: odul });
    if (tilsimlar.includes("hamarat") && kalan) {
      odul += kalan;
      satirlar.push({ id: "hamarat", deger: kalan });
    }
    if (tur === "zorlu") {
      const ek = Math.round(odul * ODUL.zorluKati) - odul;
      odul += ek;
      satirlar.push({ ad: "Zorlu bulmaca ×1,5", deger: ek });
    }
  }
  const faiz = faizHesapla(eldeki, tilsimlar);
  if (faiz) {
    satirlar.push({ ad: `Faiz: her ${ODUL.faizBolen} mürekkep için 1`, deger: Math.min(faiz, ODUL.faizSiniri) });
    if (faiz > ODUL.faizSiniri) satirlar.push({ id: "kumbara", deger: faiz - ODUL.faizSiniri });
  }
  return { satirlar, toplam: odul + faiz };
}
