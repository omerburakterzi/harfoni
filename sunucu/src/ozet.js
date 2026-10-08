// Gizli anahtarlar sunucuda açık halde değil, SHA-256 özeti olarak saklanır.
export async function anahtarOzeti(anahtar) {
  const veri = new TextEncoder().encode(anahtar);
  const ozet = await crypto.subtle.digest("SHA-256", veri);
  return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
