// Oda kodları: 6 karakter. Karıştırılabilecek harfler (O/0, I/1, L) yok.
const KOD_HARFLERI = "ABCDEFGHJKMNPRSTUVYZ23456789";

function kodUret() {
  const sayilar = crypto.getRandomValues(new Uint8Array(6));
  return [...sayilar].map((s) => KOD_HARFLERI[s % KOD_HARFLERI.length]).join("");
}

// Boş bir kod bulup odayı kurar. ayarlar: { mod, eslesme, bot, puansiz }
//   eslesme: rastgele eşleşen iki oyuncu için mi
//   bot: bota karşı oyunsa seviyesi
//   puansiz: arkadaş maçı puana sayılmasın
export async function odaAc(env, ayarlar) {
  for (let deneme = 0; deneme < 5; deneme++) {
    const kod = kodUret();
    const oda = env.ODALAR.get(env.ODALAR.idFromName(kod));
    if (await oda.kur(kod, ayarlar)) return kod;
  }
  return null;
}
