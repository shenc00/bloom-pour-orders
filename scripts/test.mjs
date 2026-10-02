import assert from "node:assert/strict";
import fs from "node:fs/promises";
import menu from "../netlify/functions/menu.mjs";
import order from "../netlify/functions/order.mjs";
import admin from "../netlify/functions/admin.mjs";

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
console.log("all tests passed; kenya left:", m.remaining.kenya);
