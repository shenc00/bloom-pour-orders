import assert from "node:assert/strict";
import fs from "node:fs/promises";
import menu from "../netlify/functions/menu.mjs";
import order from "../netlify/functions/order.mjs";
import admin from "../netlify/functions/admin.mjs";
import coffees from "../netlify/functions/coffees.mjs";
import qr from "../netlify/functions/qr.mjs";
import { poursPerBag, bagCostSgd, costPerPour, salesPrice } from "../public/pricing.mjs";

// ---- pricing formulas ----
assert.equal(poursPerBag(100, 15), 6, "100g bag, 15g pour");
assert.equal(poursPerBag(250, 15), 16, "rounds down to whole pours");
assert.equal(poursPerBag(10, 15), 0); assert.equal(poursPerBag(0, 15), 0); assert.equal(poursPerBag(100, 0), 0);
assert.equal(bagCostSgd(25, 0.8), 31.25); assert.equal(bagCostSgd(25, 0), null); assert.equal(bagCostSgd(NaN, 1), null);
assert.equal(costPerPour(250, 15, 25, 0.8), 1.95, "31.25 / 16 pours");
assert.equal(costPerPour(100, 15, 30, 1), 5, "SGD bag, rate 1");
assert.equal(costPerPour(10, 15, 30, 1), null, "bag smaller than a pour");
assert.equal(costPerPour(100, 15, NaN, 1), null, "no bag price yet");
assert.equal(salesPrice(1.95), 6, "(1.95 + 1) x 2 = 5.90, rounded up");
assert.equal(salesPrice(2.5), 7, "exact whole dollar stays put");
assert.equal(salesPrice(2.51), 8); assert.equal(salesPrice(0), 2); assert.equal(salesPrice(null), null); assert.equal(salesPrice(NaN), null);
assert.equal(salesPrice(1.1), 5, "float noise: (1.1 + 1) x 2 = 4.2");

await fs.rm(".data", { recursive: true, force: true });
const post = (b) => order(new Request("http://x/api/order", { method: "POST", body: JSON.stringify(b) }));
const base = { name: "Amy", phone: "91234567", method: "collection", slot: "10am – 12pm", items: { gesha: 1, landrace: 0, kenya: 1 } };

let r = await post(base); assert.equal(r.status, 200); assert.equal((await r.json()).order.total, 13);
r = await post({ ...base, items: { gesha: 3, landrace: 0, kenya: 0 } }); assert.equal(r.status, 409, "gesha oversell blocked (1 already sold)");
r = await post({ ...base, items: { gesha: 2, landrace: 0, kenya: 0 } }); assert.equal(r.status, 200);
r = await post({ ...base, method: "delivery", address: "Blk 1 #01-01", items: { gesha: 0, landrace: 3, kenya: 0 } });
assert.equal(r.status, 400, "delivery under 4 cups rejected");
r = await post({ ...base, method: "delivery", address: "", items: { gesha: 0, landrace: 3, kenya: 1 } }); assert.equal(r.status, 400, "address needed");
r = await post({ ...base, method: "delivery", address: "Blk 1 #01-01", items: { gesha: 0, landrace: 3, kenya: 1 } }); assert.equal(r.status, 200);
r = await post({ ...base, items: { gesha: 0, landrace: 0, kenya: 0 } }); assert.equal(r.status, 400, "empty order");
r = await post({ ...base, slot: "midnight" }); assert.equal(r.status, 400);
r = await post({ ...base, phone: "abc" }); assert.equal(r.status, 400);

// 5 simultaneous orders for the last 7 kenya cups (8 sold? -> 1+1 so far) must never exceed 10
const burst = await Promise.all(Array.from({ length: 6 }, (_, i) => post({ ...base, name: "B" + i, items: { gesha: 0, landrace: 0, kenya: 2 } })));
const m = await (await menu()).json();
assert.ok(m.remaining.kenya >= 0 && m.remaining.kenya <= 10);
assert.equal(burst.filter((x) => x.status === 200).length * 2 + 2, 10 - m.remaining.kenya, "stock accounting matches accepted orders");

let a = await admin(new Request("http://x/api/admin", { headers: { "x-admin-password": "nope" } })); assert.equal(a.status, 401);
a = await admin(new Request("http://x/api/admin", { headers: { "x-admin-password": "test" } })); assert.equal(a.status, 200);

// ---- library, sales, batches ----
{ // an old free-text brewMethod survives edits made through the new form
  const { libraryStore } = await import("../netlify/functions/lib/store.mjs");
  await libraryStore().put({ id: "oldbrew", name: "Old Brew", brewMethod: "V60 old note" });
  const rr = await admin(new Request("http://x/api/admin", { method: "POST", headers: { "x-admin-password": "test" }, body: JSON.stringify({ action: "coffee.save", id: "oldbrew", name: "Old Brew", brewRatio: "1:16", brewTemp: "94" }) }));
  assert.equal(rr.status, 200);
  const kept = (await (await rr.json()).library).find((c) => c.id === "oldbrew");
  assert.equal(kept.brewMethod, "V60 old note", "old brew method kept"); assert.equal(kept.brewRatio, "1:16");
  await libraryStore().del("oldbrew");
}
const adm = (method, body, sale = "") => admin(new Request("http://x/api/admin?sale=" + sale, { method, headers: { "x-admin-password": "test" }, body: body && JSON.stringify(body) }));
r = await admin(new Request("http://x/api/admin", { method: "POST", body: "{}" })); assert.equal(r.status, 401, "edits need password");

let v = await (await adm("GET")).json();
assert.equal(v.library.length, 3, "library pre-loaded with the 3 current coffees");
assert.equal(v.menu.id, "legacy"); assert.equal(v.sales.length, 1);

// ---- update the current (original) sale: add and remove coffees ----
{
  const upd = (items, extra = {}) => adm("POST", { action: "sale.save", batch: "legacy", eventDate: "Sunday 4/10", hours: "8.30am – 4pm", slots: "10am – 12pm\n12pm – 2pm", items, ...extra });
  const three = [{ id: "gesha", price: 7, cap: 3 }, { id: "landrace", price: 6, cap: 3 }, { id: "kenya", price: 6, cap: 10 }];
  assert.ok(v.ordered.gesha >= 1 && v.ordered.kenya >= 1, "admin view reports cups ordered");
  r = await upd(three.filter((i) => i.id !== "kenya")); assert.equal(r.status, 400, "cannot remove a coffee that has orders");
  assert.match((await r.json()).error, /Can't remove .*Kenya/);
  r = await upd(three.map((i) => (i.id === "gesha" ? { ...i, cap: 1 } : i))); assert.equal(r.status, 400, "cannot set cups below what is ordered");
  await adm("POST", { action: "coffee.save", name: "Temp Coffee", origin: "Peru", salesPrice: "9" });
  const temp = (await (await adm("GET")).json()).library.find((c) => c.name === "Temp Coffee");
  r = await upd([...three, { id: temp.id, price: 9, cap: 4 }]); assert.equal(r.status, 200, "add a coffee to the current sale");
  let w = await (await adm("GET")).json();
  assert.equal(w.menu.id, "legacy"); assert.equal(w.sales.length, 1, "edited original sale is not duplicated");
  assert.equal(w.menu.items.length, 4); assert.equal(w.remaining[temp.id], 4); assert.equal(w.ordered[temp.id], undefined);
  assert.equal((await (await menu()).json()).menu.items.length, 4, "main page shows the added coffee");
  assert.equal(w.orders.length, v.orders.length, "orders stay with the sale");
  r = await upd(three); assert.equal(r.status, 200, "remove a coffee nobody ordered");
  w = await (await adm("GET")).json(); assert.equal(w.menu.items.length, 3);
  assert.equal((await (await menu()).json()).menu.items.length, 3, "main page drops it again");
  await adm("POST", { action: "coffee.delete", id: temp.id });
}

r = await adm("POST", { action: "coffee.save", name: "El Diviso Geisha", origin: "Colombia", process: "Washed", roast: "Light",
  taste: "Jasmine", note: "A short note", roastery: "Sey", brewRatio: "1:15.7", brewTemp: "93.7", costPrice: "2.37", salesPrice: "8", bagGrams: "250", pourGrams: "15", bagPrice: "25", exchangeRate: "0.8137" });
assert.equal(r.status, 200);
r = await adm("POST", { action: "coffee.save", name: "Bad", costPrice: "abc" }); assert.equal(r.status, 400, "price must be a number");
r = await adm("POST", { action: "coffee.save", name: "Bad", brewRatio: "strong" }); assert.equal(r.status, 400, "brew ratio must look like 1:15");
r = await adm("POST", { action: "coffee.save", name: "Bad", brewTemp: "hot" }); assert.equal(r.status, 400, "temperature must be a number");
r = await adm("POST", { action: "coffee.save", name: "Bad", bagGrams: "lots" }); assert.equal(r.status, 400, "grams must be a number");
r = await adm("POST", { action: "coffee.save", name: "" }); assert.equal(r.status, 400, "name required");
v = await (await adm("GET")).json();
const geisha = v.library.find((c) => c.name === "El Diviso Geisha");
assert.equal(geisha.brewRatio, "1:15.7"); assert.equal(geisha.brewTemp, 93.7, "admin sees brew settings");
assert.equal(geisha.costPrice, 2.37); assert.equal(geisha.salesPrice, 8);
assert.deepEqual([geisha.bagGrams, geisha.pourGrams, geisha.bagPrice, geisha.exchangeRate], [250, 15, 25, 0.8137], "calculator inputs saved");
assert.equal(v.library.find((c) => c.id === "kenya").salesPrice, 6, "seeded coffees get their current price as sales price");

const pub = JSON.stringify(await (await coffees()).json()) + JSON.stringify(await (await menu()).json());
assert.ok(!pub.includes("1:15.7") && !pub.includes("93.7") && !pub.includes("brewRatio"), "brew settings never public");
assert.ok(!pub.includes("2.37") && !pub.includes("costPrice"), "cost price never public");
assert.ok(!pub.includes("0.8137") && !pub.includes("bagGrams"), "calculator inputs never public");
let cf = (await (await coffees()).json()).coffees;
assert.equal(cf.length, 4); assert.ok(cf.filter((c) => c.onSale).length === 3, "legacy 3 on sale, new coffee greyed");

const sale = { action: "sale.save", eventDate: "Sunday 11/10", hours: "9am – 1pm", slots: "9am – 11am\n11am – 1pm", notes: "Hot only",
  items: [{ id: geisha.id, price: 8, cap: 2 }, { id: "kenya", price: 6, cap: 5 }] };
r = await adm("POST", { ...sale, items: [{ id: "nope", price: 1, cap: 1 }] }); assert.equal(r.status, 400, "unknown coffee");
r = await adm("POST", { ...sale, items: [{ id: "kenya", price: 0, cap: 1 }] }); assert.equal(r.status, 400, "bad price");
r = await adm("POST", { ...sale, items: [] }); assert.equal(r.status, 400, "empty sale");
r = await adm("POST", sale); assert.equal(r.status, 200);
v = await (await adm("GET")).json();
assert.equal(v.sales.length, 2, "legacy kept: it has orders"); assert.equal(v.menu.eventDate, "Sunday 11/10");
assert.equal(v.orders.length, 0, "new sale starts with no orders");
assert.equal(v.menu.items[0].brewRatio, undefined, "sale snapshot has no brew settings");
assert.equal(v.menu.items[0].costPrice, undefined, "sale snapshot has no cost price");
assert.equal(v.menu.items[0].bagPrice, undefined, "sale snapshot has no calculator inputs");
const batch = v.menu.id;

const m2 = await (await menu()).json();
assert.deepEqual(m2.remaining, { [geisha.id]: 2, kenya: 5 }, "stock reset for new sale");
cf = (await (await coffees()).json()).coffees; assert.equal(cf.filter((c) => c.onSale).length, 2);
r = await post({ ...base, slot: "9am – 11am", items: { [geisha.id]: 2, kenya: 1 } }); assert.equal(r.status, 200);
r = await post({ ...base, slot: "9am – 11am", items: { [geisha.id]: 1, kenya: 0 } }); assert.equal(r.status, 409, "new sale stock enforced");
r = await post({ ...base, slot: "10am – 12pm", items: { kenya: 1 } }); assert.equal(r.status, 400, "old slot rejected");

v = await (await adm("GET", null, "legacy")).json();
assert.ok(v.orders.length >= 3 && v.orders.every((o) => (o.batch ?? "legacy") === "legacy"), "past sale orders still viewable");
v = await (await adm("GET", null, batch)).json(); assert.equal(v.orders.length, 1);
assert.deepEqual(v.costs, { [geisha.id]: 2.37, kenya: null }, "sale keeps cost prices; unknown cost is null");
const pubMenu = JSON.stringify(await (await menu()).json());
assert.ok(!pubMenu.includes("costs") && !pubMenu.includes("2.37"), "cost never in public menu");
const oid = v.orders[0].id, patch = (b) => adm("PATCH", { id: oid, ...b }, batch);
r = await patch({ discount: 1.5 }); assert.equal(r.status, 200);
assert.equal((await r.json()).orders[0].discount, 1.5, "promo saved on order");
r = await patch({ discount: 999 }); assert.equal(r.status, 400, "promo above order total rejected");
r = await patch({ discount: -1 }); assert.equal(r.status, 400, "negative promo rejected");
r = await patch({ discount: "abc" }); assert.equal(r.status, 400, "non-numeric promo rejected");
r = await patch({ discount: 0 }); assert.equal((await r.json()).orders[0].discount, 0, "promo can be cleared");
await patch({ discount: 2 });

r = await adm("POST", { ...sale, batch, hours: "10am – 2pm", items: [{ id: geisha.id, price: 8, cap: 4 }, { id: "kenya", price: 6, cap: 5 }] });
assert.equal(r.status, 200); v = await (await adm("GET")).json();
assert.equal(v.menu.id, batch); assert.equal(v.menu.hours, "10am – 2pm"); assert.equal(v.remaining[geisha.id], 2, "update in place keeps orders");

r = await adm("POST", { action: "coffee.delete", id: geisha.id }); assert.equal(r.status, 200);
v = await (await adm("GET")).json(); assert.equal(v.library.length, 3);
assert.equal(v.menu.items[0].name, "El Diviso Geisha", "deleting from library leaves the sale intact");

// ---- PayNow QR ----
v = await (await adm("GET")).json();
assert.deepEqual(v.qr, { expiry: "2026-10-05", custom: false, updatedAt: null }, "default QR info");
r = await qr(new Request("http://x/api/qr")); assert.equal(r.status, 302); assert.equal(new URL(r.headers.get("location")).pathname, "/paynow-qr.png");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
r = await adm("POST", { action: "qr.save", expiry: "soon", image: PNG }); assert.equal(r.status, 400, "bad date");
r = await adm("POST", { action: "qr.save", expiry: "2026-12-31", image: "data:text/html;base64,PHNjcmlwdD4=" }); assert.equal(r.status, 400, "non-image rejected");
r = await adm("POST", { action: "qr.save", expiry: "2026-12-31", image: PNG }); assert.equal(r.status, 200);
r = await qr(new Request("http://x/api/qr")); assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/png");
assert.equal(Buffer.from(await r.arrayBuffer()).toString("base64"), PNG.split(",")[1], "served image matches upload");
r = await adm("POST", { action: "qr.save", expiry: "2027-01-31" }); assert.equal(r.status, 200, "date-only update");
v = await (await adm("GET")).json(); assert.equal(v.qr.expiry, "2027-01-31"); assert.ok(v.qr.custom, "image kept on date-only update");
assert.ok(!JSON.stringify(v).includes("base64"), "admin view does not ship the image");

console.log("all tests passed; kenya left:", m.remaining.kenya);
