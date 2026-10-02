// Optional Telegram alert. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars; never throws.
export async function notify(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
    if (!r.ok) console.error("Telegram notify failed", r.status, await r.text());
  } catch (e) { console.error("Telegram notify failed", e); }
}
