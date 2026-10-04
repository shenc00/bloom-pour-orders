import { currentSale, getLibrary, pick, PUBLIC_FIELDS } from "./lib/sale.mjs";
import { json } from "./lib/logic.mjs";

// Public: the whole library, flagged by whether it is on sale now. Brew method is never included.
export default async () => {
  const [library, sale] = await Promise.all([getLibrary(), currentSale()]);
  const on = new Set(sale.items.map((i) => i.id));
  const coffees = library.map((c) => ({ id: c.id, ...pick(c, PUBLIC_FIELDS), onSale: on.has(c.id) }));
  return json({ coffees: [...coffees.filter((c) => c.onSale), ...coffees.filter((c) => !c.onSale)] });
};
export const config = { path: "/api/coffees" };
