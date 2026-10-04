import { MENU } from "./menu.mjs";
import { libraryStore, salesStore } from "./store.mjs";
import { fullName } from "./logic.mjs";

// Library coffees have these fields. brewMethod is private: never copy it to a sale or a public response.
export const COFFEE_FIELDS = ["name", "origin", "process", "taste", "roast", "note", "roastery", "brewMethod"];
export const PUBLIC_FIELDS = COFFEE_FIELDS.filter((f) => f !== "brewMethod");
export const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? ""]));

const legacy = () => ({ ...MENU, id: "legacy", publishedAt: 0 });

// Newest first. Stored sales override the defaults in menu.mjs. The pre-sales "legacy" sale
// is the fallback until a sale is published, and stays listed while it still has orders.
export async function listSales(orders = []) {
  const stored = (await salesStore().list()).sort((a, b) => b.publishedAt - a.publishedAt).map((s) => ({ ...MENU, ...s }));
  return !stored.length || orders.some((o) => (o.batch ?? "legacy") === "legacy") ? [...stored, legacy()] : stored;
}
export async function currentSale() { return (await listSales())[0]; }

// The library is pre-loaded once with the coffees from menu.mjs, then is yours to edit.
export async function getLibrary() {
  const s = libraryStore();
  if (!(await s.get("_seeded"))) {
    for (const i of MENU.items) await s.put({ ...pick(i, COFFEE_FIELDS), id: i.id });
    await s.put({ id: "_seeded" });
  }
  return (await s.list()).filter((c) => c.id !== "_seeded").sort((a, b) => fullName(a).localeCompare(fullName(b)));
}
