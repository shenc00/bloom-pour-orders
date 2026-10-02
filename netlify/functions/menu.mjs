import { MENU } from "./lib/menu.mjs";
import { ordersStore } from "./lib/store.mjs";
import { remainingStock, json } from "./lib/logic.mjs";

export default async () => json({ menu: MENU, remaining: remainingStock(await ordersStore().list()) });
export const config = { path: "/api/menu" };
