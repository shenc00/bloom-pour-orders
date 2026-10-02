import { timingSafeEqual } from "node:crypto";
import { ordersStore } from "./lib/store.mjs";
import { remainingStock, byCreated, json } from "./lib/logic.mjs";
import { MENU } from "./lib/menu.mjs";

function authorised(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const given = Buffer.from(req.headers.get("x-admin-password") || "");
  const want = Buffer.from(pw);
  return given.length === want.length && timingSafeEqual(given, want);
}

export default async (req) => {
  const ok = authorised(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD is not set on the server." }, 503);
  if (!ok) return json({ error: "Wrong password." }, 401);
  const store = ordersStore();

  if (req.method === "PATCH") {
    const { id, paid, collected, cancelled } = await req.json();
    const o = await store.get(id);
    if (!o) return json({ error: "Order not found" }, 404);
    if (typeof paid === "boolean") o.paid = paid;
    if (typeof collected === "boolean") o.collected = collected;
    if (typeof cancelled === "boolean") o.cancelled = cancelled;
    await store.put(o);
  }
  const orders = (await store.list()).sort(byCreated);
  return json({ menu: MENU, orders, remaining: remainingStock(orders) });
};
export const config = { path: "/api/admin" };
