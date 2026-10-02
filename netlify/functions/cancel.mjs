import { ordersStore } from "./lib/store.mjs";
import { json } from "./lib/logic.mjs";
import { notify } from "./lib/notify.mjs";

// Lets a customer cancel their own order (to edit it). The order id is an unguessable UUID
// that only the customer's confirmation page knows. Paid/collected orders must go through the seller.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let id;
  try { ({ id } = await req.json()); } catch { return json({ error: "Bad request" }, 400); }
  if (typeof id !== "string" || id.length < 20) return json({ error: "Order not found" }, 404);

  const store = ordersStore();
  const o = await store.get(id);
  if (!o) return json({ error: "Order not found" }, 404);
  if (o.paid || o.collected)
    return json({ error: "This order is already paid or collected, so it can't be changed here. Please WhatsApp us." }, 409);
  if (!o.cancelled) {
    o.cancelled = true;
    await store.put(o);
    await notify(`Order cancelled by customer (editing): ${o.name} (${o.phone}), $${o.total}. Stock released.`);
  }
  return json({ ok: true });
};
export const config = { path: "/api/cancel" };
