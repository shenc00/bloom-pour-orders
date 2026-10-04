import assert from "node:assert/strict";
import fs from "node:fs/promises";
import menu from "../netlify/functions/menu.mjs";
import order from "../netlify/functions/order.mjs";
import admin from "../netlify/functions/admin.mjs";
import coffees from "../netlify/functions/coffees.mjs";

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
const adm = (method, body, sale = "") => admin(new Request("http://x/api/admin?sale=" + sale, { method, headers: { "x-admin-password": "test" }, body: body && JSON.stringify(body) }));
r = await admin(new Request("http://x/api/admin", { method: "POST", body: "{}" })); assert.equal(r.status, 401, "edits need password");

let v = await (await adm("GET")).json();
assert.equal(v.library.length, 3, "library pre-loaded with the 3 current coffees");
assert.equal(v.menu.id, "legacy"); assert.equal(v.sales.length, 1);

r = await adm("POST", { action: "coffee.save", name: "El Diviso Geisha", origin: "Colombia", process: "Washed", roast: "Light",
  taste: "Jasmine", note: "A short note", roastery: "Sey", brewMethod: "SECRET-V60 1:16 93C" });
assert.equal(r.status, 200);
r = await adm("POST", { action: "coffee.save", name: "" }); assert.equal(r.status, 400, "name required");
v = await (await adm("GET")).json();
const geisha = v.library.find((c) => c.name === "El Diviso Geisha");
assert.equal(geisha.brewMethod, "SECRET-V60 1:16 93C", "admin sees brew method");

const pub = JSON.stringify(await (await coffees()).json()) + JSON.stringify(await (await menu()).json());
assert.ok(!pub.includes("SECRET-V60"), "brew method never public");
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
assert.equal(v.menu.items[0].brewMethod, undefined, "sale snapshot has no brew method");
const batch = v.menu.id;

const m2 = await (await menu()).json();
assert.deepEqual(m2.remaining, { [geisha.id]: 2, kenya: 5 }, "stock reset for new sale");
cf = (await (await coffees()).json()).coffees; assert.equal(cf.filter((c) => c.onSale).length, 2);
r = await post({ ...base, slot: "9am – 11am", items: { [geisha.id]: 2, kenya: 1 } }); assert.equal(r.status, 200);
r = await post({ ...base, slot: "9am – 11am", items: { [geisha.id]: 1, kenya: 0 } }); assert.equal(r.status, 409, "new sale stock enforced");
r = await post({ ...base, slot: "10am – 12pm", items: { kenya: 1 } }); assert.equal(r.status, 400, "old slot rejected");

v = await (await adm("GET", null, "legacy")).json();
assert.ok(v.orders.length > 5 && v.orders.every((o) => (o.batch ?? "legacy") === "legacy"), "past sale orders still viewable");
v = await (await adm("GET", null, batch)).json(); assert.equal(v.orders.length, 1);

r = await adm("POST", { ...sale, batch, hours: "10am – 2pm", items: [{ id: geisha.id, price: 8, cap: 4 }, { id: "kenya", price: 6, cap: 5 }] });
assert.equal(r.status, 200); v = await (await adm("GET")).json();
assert.equal(v.menu.id, batch); assert.equal(v.menu.hours, "10am – 2pm"); assert.equal(v.remaining[geisha.id], 2, "update in place keeps orders");

r = await adm("POST", { action: "coffee.delete", id: geisha.id }); assert.equal(r.status, 200);
v = await (await adm("GET")).json(); assert.equal(v.library.length, 3);
assert.equal(v.menu.items[0].name, "El Diviso Geisha", "deleting from library leaves the sale intact");

console.log("all tests passed; kenya left:", m.remaining.kenya);
