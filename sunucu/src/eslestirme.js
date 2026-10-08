// Rastgele rakip bulma. "Rakip bul"a basan oyuncular burada WebSocket ile
// bekler; aynı modda bekleyen biri varsa (puanı en yakın olan) ikisi için
// oda açılır ve oda kodu ikisine de gönderilir.

import { DurableObject } from "cloudflare:workers";
import { anahtarOzeti } from "./ozet.js";
import { odaAc } from "./kod.js";
import { MODLAR } from "./oda.js";

export class Eslestirme extends DurableObject {
  async fetch(istek) {
    if (istek.headers.get("Upgrade") !== "websocket") return new Response("WebSocket gerekli", { status: 426 });
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
    if (mesaj.t !== "ara") return;
    const { id, anahtar, mod } = mesaj;
    if (typeof id !== "string" || typeof anahtar !== "string" || !MODLAR[mod]) return ws.close(4002, "Geçersiz istek");
    const oyuncular = this.env.OYUNCULAR.get(this.env.OYUNCULAR.idFromName("tum"));
    const oyuncu = await oyuncular.dogrula(id, await anahtarOzeti(anahtar));
    if (!oyuncu) return ws.close(4002, "Kimlik doğrulanamadı");

    // Aynı oyuncu iki sekmeden arıyorsa eskisini kapat.
    for (const eski of this.ctx.getWebSockets()) {
      if (eski !== ws && eski.deserializeAttachment()?.id === id) eski.close(4000, "Başka yerden aranıyor");
    }
    ws.serializeAttachment({ id, mod, puan: oyuncu.puanlar[mod].puan, zaman: Date.now() });
    await this.#eslestir(ws);
  }

  async #eslestir(ws) {
    const ben = ws.deserializeAttachment();
    const adaylar = this.ctx
      .getWebSockets()
      .filter((o) => o !== ws && o.readyState === WebSocket.OPEN)
      .map((o) => [o, o.deserializeAttachment()])
      .filter(([, a]) => a && a.mod === ben.mod && a.id !== ben.id && !a.eslesti);
    if (!adaylar.length) {
      ws.send(JSON.stringify({ t: "bekle" }));
      return;
    }
    adaylar.sort((x, y) => Math.abs(x[1].puan - ben.puan) - Math.abs(y[1].puan - ben.puan));
    const [rakipWs, rakip] = adaylar[0];

    // Oda açılırken başka biri bu ikisiyle eşleşmesin.
    ws.serializeAttachment({ ...ben, eslesti: true });
    rakipWs.serializeAttachment({ ...rakip, eslesti: true });

    const kod = await odaAc(this.env, ben.mod, true);
    for (const soket of [ws, rakipWs]) {
      try {
        if (kod) soket.send(JSON.stringify({ t: "bulundu", kod }));
        soket.close(1000, kod ? "Rakip bulundu" : "Oda açılamadı");
      } catch {
        // bu arada ayrılmış olabilir
      }
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {
      // zaten kapalı
    }
  }
}
