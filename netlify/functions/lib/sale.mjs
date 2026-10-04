import { MENU } from "./menu.mjs";
import { libraryStore, salesStore } from "./store.mjs";
import { fullName } from "./logic.mjs";

// Library coffees have these fields. Only PUBLIC_FIELDS are copied into a sale or sent to customers;
// everything else is private to admin. salesPrice is the default price when you set up a sale.
// brewRatio and brewTemp are the private brew settings; the four after salesPrice are the cost calculator's saved inputs.
// An older free-text `brewMethod` may still sit on a record: it is kept as is, never edited or shown to customers.
export const PUBLIC_FIELDS = ["name", "origin", "process", "taste", "roast", "note", "roastery"];
export const NUMBER_FIELDS = ["costPrice", "salesPrice", "bagGrams", "pourGrams", "bagPrice", "exchangeRate", "brewTemp"];
export const COFFEE_FIELDS = [...PUBLIC_FIELDS, "brewRatio", ...NUMBER_FIELDS];
export const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? ""]));

// Sales carry a private `costs` map (coffee id -> cost per cup, null if unknown) for profit figures.
export const publicSale = ({ costs, ...sale }) => sale;
// The legacy sale predates stored costs, so it uses the library's current cost prices.
export const saleCosts = (sale, library) =>
  sale.costs ?? Object.fromEntries(sale.items.map((i) => [i.id, costOf(library.find((c) => c.id === i.id))]));
export const costOf = (c) => (c && c.costPrice !== "" && c.costPrice != null ? Number(c.costPrice) : null);

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
    for (const i of MENU.items) await s.put({ ...pick(i, COFFEE_FIELDS), id: i.id, salesPrice: i.price });
    await s.put({ id: "_seeded" });
  }
  return (await s.list()).filter((c) => c.id !== "_seeded").sort((a, b) => fullName(a).localeCompare(fullName(b)));
}
