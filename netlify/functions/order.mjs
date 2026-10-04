import { ordersStore } from "./lib/store.mjs";
import { remainingStock, validateOrder, fullName, json } from "./lib/logic.mjs";
import { currentSale } from "./lib/sale.mjs";
import { notify } from "./lib/notify.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (body.website) return json({ ok: true }); // honeypot: bots fill this in

  const sale = await currentSale();
  const { error, order } = validateOrder(body, sale);
  if (error) return json({ error }, 400);

  const store = ordersStore();
  const before = remainingStock(await store.list(), sale);
  for (const i of sale.items)
    if (order.items[i.id] > before[i.id])
      return json({ error: `Sorry, only ${before[i.id]} cup(s) of ${fullName(i)} left.`, remaining: before }, 409);

  // Write first, then re-check against every other visible order. Two simultaneous orders for the
  // last cups may both be turned away (they can retry), but they can never both be accepted.
  await store.put(order);
  const left = remainingStock((await store.list()).filter((o) => o.id !== order.id), sale);
  const oversold = sale.items.find((i) => order.items[i.id] > left[i.id]);
  if (oversold) {
    await store.del(order.id);
    const now = remainingStock(await store.list(), sale);
    const error = now[oversold.id] >= order.items[oversold.id]
      ? "Another order came in at the same moment. Please press Place order again."
      : `Sorry, ${fullName(oversold)} just sold out. Please adjust your order.`;
    return json({ error, remaining: now }, 409);
  }
  const lines = sale.items.filter((i) => order.items[i.id] > 0).map((i) => `${order.items[i.id]} x ${fullName(i)}`);
  await notify([
    `New Bloom Pour order: ${order.name} (${order.phone})`,
    ...lines,
    `Total: $${order.total} (${order.cups} cups)`,
    `${order.method === "delivery" ? "Delivery to " + order.address : "Self-collection"} | ${order.slot}`,
    order.notes ? `Notes: ${order.notes}` : "",
  ].filter(Boolean).join("\n"));
  return json({ ok: true, order: { id: order.id, name: order.name, items: order.items, cups: order.cups, total: order.total, method: order.method, slot: order.slot } });
};
export const config = { path: "/api/order" };
