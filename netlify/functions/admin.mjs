import { timingSafeEqual } from "node:crypto";
import { ordersStore, libraryStore, salesStore, settingsStore } from "./lib/store.mjs";
import { qrInfo } from "./lib/qr.mjs";
import { remainingStock, byCreated, inSale, fullName, json } from "./lib/logic.mjs";
import { listSales, getLibrary, pick, saleCosts, costOf, COFFEE_FIELDS, PUBLIC_FIELDS, PRICE_FIELDS } from "./lib/sale.mjs";
import { MENU } from "./lib/menu.mjs";

function authorised(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const given = Buffer.from(req.headers.get("x-admin-password") || "");
  const want = Buffer.from(pw);
  return given.length === want.length && timingSafeEqual(given, want);
}

const clean = (v, max = 120) => String(v ?? "").trim().slice(0, max);
const lines = (v) => String(v ?? "").split("\n").map((l) => clean(l)).filter(Boolean);
const newId = () => crypto.randomUUID().slice(0, 8);

// Library and sale edits. Returns an error message, or nothing on success.
async function act(b) {
  const library = libraryStore(), sales = salesStore();
  if (b.action === "coffee.save") {
    if (b.id === "_seeded") return "Coffee not found.";
    await getLibrary();
    if (b.id && !(await library.get(b.id))) return "Coffee not found.";
    const c = { id: b.id || newId() };
    for (const f of COFFEE_FIELDS.filter((f) => !PRICE_FIELDS.includes(f))) c[f] = clean(b[f], f === "note" || f === "brewMethod" ? 600 : 120);
    for (const f of PRICE_FIELDS) {
      const v = clean(b[f], 12);
      if (v && !(Number(v) >= 0)) return "Cost price and sales price must be numbers.";
      c[f] = v === "" ? "" : Number(v);
    }
    if (!c.name) return "Coffee needs a name.";
    return void (await library.put(c));
  }
  if (b.action === "coffee.delete") {
    if (b.id === "_seeded") return "Coffee not found.";
    return void (await library.del(b.id)); // past sales keep their own copy, so they are unaffected
  }
  if (b.action === "sale.save") {
    const byId = Object.fromEntries((await getLibrary()).map((c) => [c.id, c]));
    const items = [], costs = {};
    for (const x of Array.isArray(b.items) ? b.items : []) {
      const c = byId[x.id];
      if (!c) return "A picked coffee is no longer in the library.";
      const price = Number(x.price), cap = Number(x.cap);
      if (!(price > 0) || !Number.isInteger(cap) || cap < 1) return `Check price and cups for ${fullName(c)}.`;
      items.push({ id: c.id, ...pick(c, PUBLIC_FIELDS), price, cap });
      costs[c.id] = costOf(c);
    }
    if (!items.length) return "Pick at least one coffee.";
    const sale = {
      eventDate: clean(b.eventDate), hours: clean(b.hours), slots: lines(b.slots),
      collectionPoint: clean(b.collectionPoint) || MENU.collectionPoint, notes: lines(b.notes), items, costs,
    };
    if (!sale.eventDate || !sale.hours || !sale.slots.length) return "Date, hours and at least one time window are needed.";
    if (b.batch) { // edit the live sale in place; orders keep counting against it
      const old = await sales.get(b.batch);
      if (!old) return "Sale not found.";
      Object.assign(sale, { id: old.id, publishedAt: old.publishedAt });
    } else Object.assign(sale, { id: newId(), publishedAt: Date.now() });
    return void (await sales.put(sale));
  }
  if (b.action === "qr.save") {
    const settings = settingsStore(), old = await settings.get("qr");
    const expiry = clean(b.expiry, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || isNaN(Date.parse(expiry))) return "Enter the date the QR expires.";
    let image = old?.image ?? ""; // no new image: keep the current one and only change the date
    if (b.image) {
      if (String(b.image).length > 1_500_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(b.image)) return "Please upload a PNG, JPG or WebP image under 1MB.";
      image = b.image;
    }
    return void (await settings.put({ id: "qr", image, expiry, updatedAt: Date.now() }));
  }
  return "Unknown action.";
}

export default async (req) => {
  const ok = authorised(req);
  if (ok === null) return json({ error: "ADMIN_PASSWORD is not set on the server." }, 503);
  if (!ok) return json({ error: "Wrong password." }, 401);
  const store = ordersStore();

  if (req.method === "PATCH") {
    const { id, paid, collected, cancelled, discount } = await req.json();
    const o = await store.get(id);
    if (!o) return json({ error: "Order not found" }, 404);
    if (typeof paid === "boolean") o.paid = paid;
    if (typeof collected === "boolean") o.collected = collected;
    if (typeof cancelled === "boolean") o.cancelled = cancelled;
    if (discount !== undefined) { // promo: money taken off this order, reduces revenue and profit
      const d = Number(discount);
      if (!(d >= 0) || d > o.total) return json({ error: `Promo must be between $0 and the order total ($${o.total}).` }, 400);
      o.discount = Math.round(d * 100) / 100;
    }
    await store.put(o);
  }
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const error = await act(body);
    if (error) return json({ error }, 400);
  }

  const all = await store.list();
  const sales = await listSales(all);
  const menu = sales.find((s) => s.id === new URL(req.url).searchParams.get("sale")) ?? sales[0];
  const orders = all.filter((o) => inSale(o, menu)).sort(byCreated);
  const library = await getLibrary();
  return json({ menu, sales, orders, remaining: remainingStock(all, menu), library, costs: saleCosts(menu, library), qr: await qrInfo() });
};
export const config = { path: "/api/admin" };
