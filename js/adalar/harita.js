// Ada haritası: 7 katmanlı dallanan yol. Katmanların düğüm türleri ve yollar
// sabit, türlerin katman içindeki yeri ve ayrıntılar (kelime uzunluğu, boss
// kuralı, sürpriz olayı, Arada düğümü) tohuma göre değişir.

import { zar, karistir, sec } from "./zar.js";

const SABLON = [
  ["bulmaca4", "bulmaca5"],
  ["bulmaca", "surpriz", "bulmaca"],
  ["miniboss"],
  ["pazar", "cesme", "bulmaca"],
  ["zorlu", "bulmaca", "surpriz"],
  ["pazar", "cesme"],
  ["bekci"],
];

// Bir düğümden sonraki katmanda gidilebilen düğümlerin sıra numaraları.
const YOLLAR = [
  [[0, 1], [1, 2]],
  [[0], [0], [0]],
  [[0, 1, 2]],
  [[0, 1], [1], [1, 2]],
  [[0], [0, 1], [1]],
  [[0], [0]],
  [[]],
];

export const KATMAN_SAYISI = SABLON.length;
const KURAL_LISTESI = ["sahmeran", "cin", "karakoncolos"];
const OLAY_LISTESI = ["sahaf", "kumarbaz", "yolcu", "kayipharf", "kuyu"];
export const BEKCI_ESIGI = 200;

export function haritaKur(tohum) {
  const r = zar(tohum, "harita");
  const katmanlar = SABLON.map((turler, k) =>
    karistir(r, turler).map((tur, sira) => ({ id: `${k}-${sira}`, katman: k, sira, tur }))
  );

  const kurallar = karistir(r, KURAL_LISTESI);
  const olaylar = karistir(r, OLAY_LISTESI);
  const bulmacalar = [];
  for (const d of katmanlar.flat()) {
    if (d.tur === "bulmaca4" || d.tur === "bulmaca5") {
      d.uzunluk = Number(d.tur.at(-1));
      d.tur = "bulmaca";
    } else if (d.tur === "bulmaca") {
      d.uzunluk = d.katman === 3 || r() < 0.5 ? 5 : 4;
      bulmacalar.push(d);
    } else if (d.tur === "zorlu") {
      d.uzunluk = 6;
    } else if (d.tur === "miniboss") {
      d.uzunluk = 5;
      d.kural = kurallar[0];
    } else if (d.tur === "bekci") {
      d.uzunluk = 5;
      d.kural = kurallar[1];
      d.esik = BEKCI_ESIGI;
    } else if (d.tur === "surpriz") {
      d.olay = olaylar.shift();
    }
  }
  const arada = sec(r, bulmacalar);
  arada.arada = true;
  arada.uzunluk = 5;

  for (const d of katmanlar.flat()) {
    d.sonraki = YOLLAR[d.katman][d.sira].map((s) => `${d.katman + 1}-${s}`);
  }
  return katmanlar;
}

export function dugumBul(harita, id) {
  const [k, s] = id.split("-").map(Number);
  return harita[k]?.[s];
}

// Şu an gidilebilecek düğümler: başta ilk katman, sonra bulunulan düğümün devamı.
export function gidilebilenler(harita, konum) {
  if (!konum) return harita[0].map((d) => d.id);
  return dugumBul(harita, konum).sonraki;
}
