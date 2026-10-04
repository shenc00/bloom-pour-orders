export const byCreated = (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);

// "Colombia" + "El Diviso Geisha" -> "Colombia El Diviso Geisha"
export const fullName = (i) => [i.origin, i.name].filter(Boolean).join(" ");

// Orders saved before sales existed have no batch; they belong to the "legacy" sale.
export const inSale = (o, sale) => (o.batch ?? "legacy") === sale.id;

export function remainingStock(orders, sale) {
  const used = Object.fromEntries(sale.items.map((i) => [i.id, 0]));
  for (const o of orders) {
    if (o.cancelled || !inSale(o, sale)) continue;
    for (const i of sale.items) used[i.id] += o.items?.[i.id] || 0;
  }
  return Object.fromEntries(sale.items.map((i) => [i.id, Math.max(0, i.cap - used[i.id])]));
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Returns { error } or { order } (not yet saved).
export function validateOrder(b, sale) {
  const clean = (v, max) => String(v ?? "").trim().slice(0, max);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 30);
  if (!name) return { error: "Please enter your name." };
  if (!/^[+\d][\d\s-]{6,}$/.test(phone)) return { error: "Please enter a valid contact number." };

  const items = {};
  let total = 0, cups = 0;
  for (const i of sale.items) {
    const q = Number(b.items?.[i.id] ?? 0);
    if (!Number.isInteger(q) || q < 0 || q > i.cap) return { error: `Invalid quantity for ${fullName(i)}.` };
    items[i.id] = q; cups += q; total += q * i.price;
  }
  if (cups < 1) return { error: "Please choose at least 1 cup." };

  const method = b.method === "delivery" ? "delivery" : b.method === "collection" ? "collection" : null;
  if (!method) return { error: "Please choose collection or delivery." };
  const address = clean(b.address, 120);
  if (method === "delivery") {
    if (cups < sale.freeDeliveryMinCups)
      return { error: `Delivery needs ${sale.freeDeliveryMinCups} cups or more. Please choose self-collection.` };
    if (!address) return { error: "Please enter your block and unit number for delivery." };
  }
  const slot = clean(b.slot, 40);
  if (!sale.slots.includes(slot)) return { error: "Please choose a time window." };

  return {
    order: {
      id: crypto.randomUUID(), createdAt: Date.now(), batch: sale.id,
      name, phone, items, cups, total, method, slot, address,
      notes: clean(b.notes, 300), paid: false, collected: false, cancelled: false,
    },
  };
}
