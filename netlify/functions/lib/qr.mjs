import { settingsStore } from "./store.mjs";
import { MENU } from "./menu.mjs";

// The uploaded QR (if any) and its expiry date. Before the first upload the QR is public/paynow-qr.png.
export async function qrInfo() {
  const q = await settingsStore().get("qr");
  return { expiry: q?.expiry ?? MENU.qrExpiry, custom: !!q?.image, updatedAt: q?.updatedAt ?? null };
}
