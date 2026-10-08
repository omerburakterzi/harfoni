// Oda kodları: 6 karakter. Karıştırılabilecek harfler (O/0, I/1, L) yok.
const KOD_HARFLERI = "ABCDEFGHJKMNPRSTUVYZ23456789";

function kodUret() {
  const sayilar = crypto.getRandomValues(new Uint8Array(6));
  return [...sayilar].map((s) => KOD_HARFLERI[s % KOD_HARFLERI.length]).join("");
}

// Boş bir kod bulup odayı kurar. eslesme: rastgele eşleşen iki oyuncu için mi.
// bot: bota karşı oyunsa seviyesi.
export async function odaAc(env, mod, eslesme = false, bot = null) {
  for (let deneme = 0; deneme < 5; deneme++) {
    const kod = kodUret();
    const oda = env.ODALAR.get(env.ODALAR.idFromName(kod));
    if (await oda.kur(kod, mod, eslesme, bot)) return kod;
  }
  return null;
}
