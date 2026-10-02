import { ordersStore } from "./lib/store.mjs";
import { remainingStock, validateOrder, byCreated, json } from "./lib/logic.mjs";
import { MENU } from "./lib/menu.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (body.website) return json({ ok: true }); // honeypot: bots fill this in

  const { error, order } = validateOrder(body);
  if (error) return json({ error }, 400);

  const store = ordersStore();
  const before = remainingStock(await store.list());
  for (const i of MENU.items)
    if (order.items[i.id] > before[i.id])
      return json({ error: `Sorry, only ${before[i.id]} cup(s) of ${i.name} left.`, remaining: before }, 409);

  // Write first, then re-check in a stable order so simultaneous orders can't oversell.
  await store.put(order);
  const all = (await store.list()).sort(byCreated);
  const earlier = [];
  for (const o of all) { if (o.id === order.id) break; earlier.push(o); }
  const left = remainingStock(earlier);
  const oversold = MENU.items.find((i) => order.items[i.id] > left[i.id]);
  if (oversold) {
    await store.del(order.id);
    return json({ error: `Sorry, ${oversold.name} just sold out. Please adjust your order.`, remaining: remainingStock(await store.list()) }, 409);
  }
  return json({ ok: true, order: { id: order.id, name: order.name, items: order.items, cups: order.cups, total: order.total, method: order.method, slot: order.slot } });
};
export const config = { path: "/api/order" };
