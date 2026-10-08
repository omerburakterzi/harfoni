// Sitenin dosyalarını uygulamanın içine (www/) kopyalar.
// Uygulama böylece internete ve harfoni.com'a bağımlı olmadan çalışır.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const burasi = dirname(fileURLToPath(import.meta.url));
const site = join(burasi, "..");
const hedef = join(burasi, "www");

const DOSYALAR = [
  "index.html", "klasik.html", "palavra.html", "arada.html", "muamma.html", "duello.html",
  "hakkinda.html", "gizlilik.html", "kurallar.html", "manifest.webmanifest",
  "css", "js", "gorseller",
];

rmSync(hedef, { recursive: true, force: true });
mkdirSync(hedef);
for (const dosya of DOSYALAR) cpSync(join(site, dosya), join(hedef, dosya), { recursive: true });
console.log(`${DOSYALAR.length} öğe www/ klasörüne kopyalandı.`);
