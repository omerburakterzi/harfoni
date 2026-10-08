// Şikâyet gelince Harfoni sahibine kısa bir e-posta. Cloudflare Email Routing
// üzerinden gider; alıcı adresi kodda değil, gizli ayar (BILDIRIM_ADRESI) olarak durur.

import { EmailMessage } from "cloudflare:email";

const GONDEREN = "bildirim@harfoni.com";

function base64(metin) {
  const baytlar = new TextEncoder().encode(metin);
  let ikili = "";
  for (const b of baytlar) ikili += String.fromCharCode(b);
  return btoa(ikili);
}

export async function bildirimGonder(env, konu, metin) {
  if (!env.EPOSTA || !env.BILDIRIM_ADRESI) return;
  const govde = base64(metin).replace(/.{76}/g, "$&\r\n");
  const ham = [
    `From: Harfoni <${GONDEREN}>`,
    `To: ${env.BILDIRIM_ADRESI}`,
    `Subject: =?UTF-8?B?${base64(konu)}?=`,
    `Message-ID: <${crypto.randomUUID()}@harfoni.com>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    govde,
  ].join("\r\n");
  try {
    await env.EPOSTA.send(new EmailMessage(GONDEREN, env.BILDIRIM_ADRESI, ham));
  } catch (hata) {
    console.log("Bildirim e-postası gönderilemedi:", hata.message);
  }
}
