import { ordersStore } from "./lib/store.mjs";
import { currentSale } from "./lib/sale.mjs";
import { remainingStock, json } from "./lib/logic.mjs";

export default async () => {
  const sale = await currentSale();
  return json({ menu: sale, remaining: remainingStock(await ordersStore().list(), sale) });
};
export const config = { path: "/api/menu" };
