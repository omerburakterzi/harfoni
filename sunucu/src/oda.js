// Bir düello odası: iki oyuncu, aynı gizli kelime, aynı anda oynanır.
// Kelimeyi daha az tahminde bulan kazanır; eşitse daha erken bulan.
// Gizli kelimeyi, süreyi ve tahminleri sunucu tutar; böylece kimse
// rakibinin harflerini ya da cevabı göremez, süreyi uzatamaz.
//
// Satrançtaki gibi herkesin kendi saati var; iki saat aynı anda akar.
// Hızlı modda her tahmin ve yeni bulunan her harf saate süre ekler.
//
// Oyuncular WebSocket ile bağlanır. Her değişiklikte sunucu iki oyuncuya da
// kendi gözünden oyunun tam halini ("durum" mesajı) gönderir.

import { DurableObject } from "cloudflare:workers";
import { CEVAPLAR, GECERLI } from "../../js/kelimeler.js";
import { degerlendir } from "../../js/ortak/degerlendir.js";
import { anahtarOzeti } from "./ozet.js";
import { bildirimGonder } from "./eposta.js";

export const HAK = 6;
export const MODLAR = {
  hizli: { sure: 3 * 60 * 1000, bonus: true },
  uzun: { sure: 10 * 60 * 1000, bonus: false },
};
// Hızlı modda: her tahmin +30 sn, ilk kez yeşil olan her kare +15 sn,
// ilk kez bulunan her turuncu harf +10 sn.
const BONUS = { tahmin: 30000, yesil: 15000, turuncu: 10000 };
const GERI_SAYIM = 3000; // iki oyuncu gelince başlamadan önce
const TEMIZLIK = 60 * 60 * 1000; // hareketsiz oda bu kadar sonra silinir
const SIKAYET_SEBEPLERI = { ad: "Uygunsuz takma ad", hile: "Hile", diger: "Başka bir sorun" };
const ESLESME_BEKLEME = 20 * 1000; // eşleşen rakip bu sürede gelmezse oda kapanır

// Son tahminin, öncekilere göre ne kadar yeni bilgi getirdiği.
export function yeniBilgi(oncekiler, tahmin, cevap) {
  const yesilYerler = new Set();
  const bilinenHarfler = new Set();
  for (const t of oncekiler) {
    degerlendir(t, cevap).forEach((renk, i) => {
      if (renk === "dogru") yesilYerler.add(i);
      if (renk !== "yok") bilinenHarfler.add(t[i]);
    });
  }
  let yesil = 0;
  const turuncu = new Set();
  degerlendir(tahmin, cevap).forEach((renk, i) => {
    if (renk === "dogru" && !yesilYerler.has(i)) yesil++;
    if (renk === "var" && !bilinenHarfler.has(tahmin[i])) turuncu.add(tahmin[i]);
  });
  return { yesil, turuncu: turuncu.size };
}

export class DuelloOdasi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.oda = (await ctx.storage.get("oda")) || null;
    });
  }

  async #kaydet() {
    await this.ctx.storage.put("oda", this.oda);
  }

  #oyuncular() {
    return this.env.OYUNCULAR.get(this.env.OYUNCULAR.idFromName("tum"));
  }

  // Oda kodu alındığında bir kez çağrılır.
  async kur(kod, mod, eslesme = false) {
    if (this.oda) return false;
    this.oda = { kod, mod: MODLAR[mod] ? mod : "hizli", eslesme, durum: "bekliyor", oyuncular: [], tahminler: {}, rovans: [], sonuc: null };
    await this.#kaydet();
    await this.ctx.storage.setAlarm(Date.now() + (eslesme ? ESLESME_BEKLEME : TEMIZLIK));
    return true;
  }

  async fetch(istek) {
    if (istek.headers.get("Upgrade") !== "websocket") return new Response("WebSocket gerekli", { status: 426 });
    if (!this.oda) return new Response("Oda bulunamadı", { status: 404 });
    const [istemci, sunucu] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(sunucu);
    return new Response(null, { status: 101, webSocket: istemci });
  }

  async webSocketMessage(ws, veri) {
    let mesaj;
    try {
      mesaj = JSON.parse(veri);
    } catch {
      return;
    }
    const kim = ws.deserializeAttachment()?.id;
    if (mesaj.t === "merhaba") return this.#merhaba(ws, mesaj);
    if (!kim) return;
    if (mesaj.t === "tahmin") return this.#tahmin(ws, kim, String(mesaj.kelime || ""));
    if (mesaj.t === "rovans") return this.#rovans(kim);
    if (mesaj.t === "sikayet") return this.#sikayet(ws, kim, mesaj.sebep);
    if (mesaj.t === "engelle") return this.#engelle(ws, kim);
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {
      // zaten kapalı
    }
    this.#yayinla();
  }

  async webSocketError() {
    this.#yayinla();
  }

  async #merhaba(ws, { id, anahtar }) {
    if (typeof id !== "string" || typeof anahtar !== "string") return this.#hata(ws, "Kimlik eksik", true);
    const oyuncu = await this.#oyuncular().dogrula(id, await anahtarOzeti(anahtar));
    if (!oyuncu) return this.#hata(ws, "Kimlik doğrulanamadı", true);
    if (oyuncu.yasakli) return this.#hata(ws, "Kurallara uymadığın için Düello'dan uzaklaştırıldın", true);

    const oda = this.oda;
    let uye = oda.oyuncular.find((o) => o.id === id);
    if (!uye) {
      if (oda.oyuncular.length >= 2) return this.#hata(ws, "Bu oda dolu", true);
      uye = { id, ad: oyuncu.ad, puan: oyuncu.puanlar[oda.mod].puan };
      oda.oyuncular.push(uye);
      oda.tahminler[id] = [];
    }

    // Aynı oyuncunun eski bağlantısı varsa kapat (ör. sayfayı yeniledi).
    for (const eski of this.ctx.getWebSockets()) {
      if (eski !== ws && eski.deserializeAttachment()?.id === id) eski.close(4000, "Başka yerden bağlanıldı");
    }
    ws.serializeAttachment({ id });

    if (oda.durum === "bekliyor" && oda.oyuncular.length === 2) await this.#baslat();
    else await this.#kaydet();
    this.#yayinla();
  }

  async #baslat() {
    const oda = this.oda;
    // TEST_CEVAP sadece yerel denemede (.dev.vars) kullanılır.
    oda.cevap = this.env.TEST_CEVAP || CEVAPLAR[Math.floor(Math.random() * CEVAPLAR.length)];
    oda.baslangic = Date.now() + GERI_SAYIM;
    oda.durum = "oyun";
    oda.sonuc = null;
    oda.rovans = [];
    oda.bulma = {}; // oyuncu kimliği -> kelimeyi bulduğu an
    oda.bitis = {}; // oyuncu kimliği -> saatinin biteceği an (bonuslarla uzar)
    oda.durdu = {}; // oyuncu kimliği -> oynamayı bitirdiği an (buldu, hakkı ya da süresi bitti)
    for (const o of oda.oyuncular) {
      oda.tahminler[o.id] = [];
      // TEST_SURE sadece yerel denemede (.dev.vars) kullanılır.
      oda.bitis[o.id] = oda.baslangic + (Number(this.env.TEST_SURE) || MODLAR[oda.mod].sure);
    }
    await this.#kaydet();
    await this.#alarmKur();
  }

  // En yakın saat bitişinde uyan.
  async #alarmKur() {
    const oda = this.oda;
    const bekleyenler = oda.oyuncular.filter((o) => oda.durdu[o.id] == null).map((o) => oda.bitis[o.id]);
    if (bekleyenler.length) await this.ctx.storage.setAlarm(Math.min(...bekleyenler));
  }

  #oyuncuBitti(id) {
    return this.oda.durdu[id] != null;
  }

  // Saati dolan oyuncuları durdurur.
  #saatleriKontrolEt(simdi) {
    const oda = this.oda;
    for (const o of oda.oyuncular) {
      if (oda.durdu[o.id] == null && simdi >= oda.bitis[o.id]) oda.durdu[o.id] = oda.bitis[o.id];
    }
  }

  async #tahmin(ws, id, kelime) {
    const oda = this.oda;
    const simdi = Date.now();
    if (oda.durum !== "oyun" || !oda.tahminler[id]) return;
    if (simdi < oda.baslangic) return this.#hata(ws, "Henüz başlamadı");
    this.#saatleriKontrolEt(simdi);
    if (this.#oyuncuBitti(id)) {
      if (this.#sonucBelli()) return this.#bitir();
      await this.#kaydet();
      this.#yayinla();
      return this.#hata(ws, "Oynama süren bitti");
    }
    kelime = kelime.toLocaleLowerCase("tr-TR");
    if ([...kelime].length !== 5) return this.#hata(ws, "Harf sayısı yetersiz");
    if (!GECERLI.has(kelime)) return this.#hata(ws, "Sözlükte yok");

    const oncekiler = oda.tahminler[id];
    if (MODLAR[oda.mod].bonus) {
      const { yesil, turuncu } = yeniBilgi(oncekiler, kelime, oda.cevap);
      oda.bitis[id] += BONUS.tahmin + yesil * BONUS.yesil + turuncu * BONUS.turuncu;
    }
    oncekiler.push(kelime);
    if (kelime === oda.cevap) oda.bulma[id] = simdi;
    if (kelime === oda.cevap || oncekiler.length >= HAK) oda.durdu[id] = simdi;

    if (this.#sonucBelli()) return this.#bitir();
    await this.#kaydet();
    await this.#alarmKur();
    this.#yayinla();
  }

  // Bulan oyuncunun tahmin sayısı (bulamadıysa null).
  #bulduguTahmin(id) {
    const t = this.oda.tahminler[id];
    return t.includes(this.oda.cevap) ? t.indexOf(this.oda.cevap) + 1 : null;
  }

  // Oyun daha fazla oynanmadan kazanan belli mi?
  #sonucBelli() {
    const [a, b] = this.oda.oyuncular;
    if (this.#oyuncuBitti(a.id) && this.#oyuncuBitti(b.id)) return true;
    // Biri n. tahminde bulduysa diğeri ancak n-1 ya da daha az tahminde bularak geçebilir.
    for (const [bulan, diger] of [[a, b], [b, a]]) {
      const n = this.#bulduguTahmin(bulan.id);
      if (n !== null && !this.#oyuncuBitti(diger.id) && this.oda.tahminler[diger.id].length >= n - 1) return true;
    }
    return false;
  }

  // Az tahmin önce gelir, eşitse erken bulan. Kimse bulamadıysa null (berabere).
  #kazanan() {
    const [a, b] = this.oda.oyuncular;
    const na = this.#bulduguTahmin(a.id);
    const nb = this.#bulduguTahmin(b.id);
    if (na === null && nb === null) return null;
    if (nb === null) return a.id;
    if (na === null) return b.id;
    if (na !== nb) return na < nb ? a.id : b.id;
    return this.oda.bulma[a.id] <= this.oda.bulma[b.id] ? a.id : b.id;
  }

  async #bitir() {
    const oda = this.oda;
    if (oda.durum !== "oyun") return;
    const kazanan = this.#kazanan();
    oda.durum = "bitti";
    // Hâlâ oynayan varsa saati şimdi durur.
    const simdi = Date.now();
    for (const o of oda.oyuncular) if (oda.durdu[o.id] == null) oda.durdu[o.id] = Math.min(simdi, oda.bitis[o.id]);
    const [a, b] = oda.oyuncular;
    const sonucA = kazanan === null ? 0.5 : kazanan === a.id ? 1 : 0;
    const puanlar = await this.#oyuncular().macSonucu(a.id, b.id, sonucA, oda.mod);
    if (puanlar) for (const o of oda.oyuncular) o.puan = puanlar[o.id].yeni;
    oda.sonuc = { kazanan, puanlar };
    await this.#kaydet();
    await this.ctx.storage.setAlarm(Date.now() + TEMIZLIK);
    this.#yayinla();
  }

  async #rovans(id) {
    const oda = this.oda;
    if (oda.durum !== "bitti" || oda.rovans.includes(id) || oda.engelli) return;
    oda.rovans.push(id);
    if (oda.rovans.length === 2) await this.#baslat();
    else await this.#kaydet();
    this.#yayinla();
  }

  #rakibi(id) {
    return this.oda.oyuncular.find((o) => o.id !== id);
  }

  async #sikayet(ws, id, sebep) {
    const rakip = this.#rakibi(id);
    if (!rakip || !SIKAYET_SEBEPLERI[sebep]) return;
    const sonuc = await this.#oyuncular().sikayetEt(id, rakip.id, sebep, this.oda.kod);
    ws.send(JSON.stringify({ t: "bilgi", mesaj: "Şikâyetin alındı, teşekkürler. İnceleyeceğiz." }));
    if (sonuc?.yeni) {
      this.ctx.waitUntil(
        bildirimGonder(
          this.env,
          `Harfoni: "${sonuc.hedefAd}" şikâyet edildi`,
          `Sebep: ${SIKAYET_SEBEPLERI[sebep]}\nŞikâyet edilen: ${sonuc.hedefAd}\nBu kişi hakkındaki açık şikâyet sayısı: ${sonuc.acik}\n\nİncelemek için: https://api.harfoni.com/yonetim`
        )
      );
    }
  }

  async #engelle(ws, id) {
    const rakip = this.#rakibi(id);
    if (!rakip) return;
    await this.#oyuncular().engelle(id, rakip.id);
    this.oda.engelli = true; // bu iki kişi rövanş yapamaz
    await this.#kaydet();
    ws.send(JSON.stringify({ t: "bilgi", mesaj: `${rakip.ad} engellendi. Bir daha eşleşmeyeceksiniz.` }));
    this.#yayinla();
  }

  async alarm() {
    const oda = this.oda;
    if (!oda) return;
    if (oda.durum === "oyun") {
      this.#saatleriKontrolEt(Date.now());
      if (this.#sonucBelli()) return this.#bitir();
      await this.#kaydet();
      await this.#alarmKur();
      return this.#yayinla();
    }
    // Uzun süre hareketsiz kalan odayı temizle. Rastgele eşleşmede rakip
    // hiç gelmediyse bekleyen oyuncu yeniden aramaya döner (4003).
    const gelmedi = oda.eslesme && oda.durum === "bekliyor";
    for (const ws of this.ctx.getWebSockets()) ws.close(gelmedi ? 4003 : 4001, gelmedi ? "Rakip bağlanamadı" : "Oda kapandı");
    await this.ctx.storage.deleteAll();
    this.oda = null;
  }

  #hata(ws, mesaj, kapat = false) {
    ws.send(JSON.stringify({ t: "hata", mesaj }));
    if (kapat) ws.close(4002, mesaj);
  }

  // Her oyuncuya kendi gözünden oyunun hali. Rakibin harfleri oyun bitene
  // kadar gönderilmez, sadece renkleri.
  #gorunum(id, bagliOlanlar) {
    const oda = this.oda;
    const ben = oda.oyuncular.find((o) => o.id === id);
    const rakip = oda.oyuncular.find((o) => o.id !== id);
    const bitti = oda.durum === "bitti";
    const oyuncu = (o, harflerle) => ({
      ad: o.ad,
      puan: o.puan,
      bitis: oda.bitis?.[o.id],
      durdu: oda.durdu?.[o.id] ?? null,
      satirlar: (oda.tahminler[o.id] || []).map((kelime) => ({
        renkler: degerlendir(kelime, oda.cevap),
        ...(harflerle ? { kelime } : {}),
      })),
    });

    return {
      t: "durum",
      kod: oda.kod,
      mod: oda.mod,
      eslesme: Boolean(oda.eslesme),
      durum: oda.durum,
      simdi: Date.now(),
      baslangic: oda.baslangic,
      hak: HAK,
      ben: oyuncu(ben, true),
      rakip: rakip && { ...oyuncu(rakip, bitti), bagli: bagliOlanlar.has(rakip.id) },
      sonuc: bitti && {
        cevap: oda.cevap,
        // kelimeyi buldukları süre (ms); bulamayan için null
        benSure: oda.bulma[id] ? oda.bulma[id] - oda.baslangic : null,
        rakipSure: rakip && oda.bulma[rakip.id] ? oda.bulma[rakip.id] - oda.baslangic : null,
        kazanan: oda.sonuc.kazanan === null ? null : oda.sonuc.kazanan === id ? "ben" : "rakip",
        puan: oda.sonuc.puanlar && oda.sonuc.puanlar[id],
      },
      rovans: { ben: oda.rovans.includes(id), rakip: Boolean(rakip && oda.rovans.includes(rakip.id)) },
      engelli: Boolean(oda.engelli),
    };
  }

  #yayinla() {
    if (!this.oda) return;
    const soketler = this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
    const bagliOlanlar = new Set(soketler.map((ws) => ws.deserializeAttachment()?.id).filter(Boolean));
    for (const ws of soketler) {
      const id = ws.deserializeAttachment()?.id;
      if (!id) continue;
      try {
        ws.send(JSON.stringify(this.#gorunum(id, bagliOlanlar)));
      } catch {
        // bağlantı tam o sırada kopmuş olabilir
      }
    }
  }
}
