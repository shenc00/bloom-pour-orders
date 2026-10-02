import { MENU } from "./menu.mjs";

export const byCreated = (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);

export function remainingStock(orders) {
  const used = Object.fromEntries(MENU.items.map((i) => [i.id, 0]));
  for (const o of orders) {
    if (o.cancelled) continue;
    for (const i of MENU.items) used[i.id] += o.items?.[i.id] || 0;
  }
  return Object.fromEntries(MENU.items.map((i) => [i.id, Math.max(0, i.cap - used[i.id])]));
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Returns { error } or { order } (not yet saved).
export function validateOrder(b) {
  const clean = (v, max) => String(v ?? "").trim().slice(0, max);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 30);
  if (!name) return { error: "Please enter your name." };
  if (!/^[+\d][\d\s-]{6,}$/.test(phone)) return { error: "Please enter a valid contact number." };

  const items = {};
  let total = 0, cups = 0;
  for (const i of MENU.items) {
    const q = Number(b.items?.[i.id] ?? 0);
    if (!Number.isInteger(q) || q < 0 || q > i.cap) return { error: `Invalid quantity for ${i.name}.` };
    items[i.id] = q; cups += q; total += q * i.price;
  }
  if (cups < 1) return { error: "Please choose at least 1 cup." };

  const method = b.method === "delivery" ? "delivery" : b.method === "collection" ? "collection" : null;
  if (!method) return { error: "Please choose collection or delivery." };
  const address = clean(b.address, 120);
  if (method === "delivery") {
    if (cups < MENU.freeDeliveryMinCups)
      return { error: `Delivery needs ${MENU.freeDeliveryMinCups} cups or more. Please choose self-collection.` };
    if (!address) return { error: "Please enter your block and unit number for delivery." };
  }
  const slot = clean(b.slot, 40);
  if (!MENU.slots.includes(slot)) return { error: "Please choose a time window." };

  return {
    order: {
      id: crypto.randomUUID(), createdAt: Date.now(),
      name, phone, items, cups, total, method, slot, address,
      notes: clean(b.notes, 300), paid: false, collected: false, cancelled: false,
    },
  };
}
