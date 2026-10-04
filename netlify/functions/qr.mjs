import { settingsStore } from "./lib/store.mjs";

// Public: the PayNow QR image. Serves the one uploaded in /admin, else the bundled public/paynow-qr.png.
export default async (req) => {
  const m = (await settingsStore().get("qr"))?.image?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return Response.redirect(new URL("/paynow-qr.png", req.url), 302);
  return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "no-cache" } });
};
export const config = { path: "/api/qr" };
