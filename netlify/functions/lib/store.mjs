import fs from "node:fs/promises";
import path from "node:path";

// On Netlify (and `netlify dev`) orders live in Netlify Blobs.
// For plain local runs/tests set LOCAL_STORE=1 to use ./.data instead.
export function ordersStore() {
  if (process.env.LOCAL_STORE === "1") return localStore();
  return blobStore();
}

function blobStore() {
  let s;
  const store = async () => (s ??= (await import("@netlify/blobs")).getStore({ name: "orders", consistency: "strong" }));
  return {
    async list() {
      const s = await store();
      const { blobs } = await s.list();
      const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
      return all.filter(Boolean);
    },
    async get(id) { return (await store()).get(id, { type: "json" }); },
    async put(o) { return (await store()).setJSON(o.id, o); },
    async del(id) { return (await store()).delete(id); },
  };
}

function localStore() {
  const dir = path.resolve(".data/orders");
  const file = (id) => path.join(dir, `${id}.json`);
  return {
    async list() {
      await fs.mkdir(dir, { recursive: true });
      const names = await fs.readdir(dir);
      return Promise.all(names.map(async (n) => JSON.parse(await fs.readFile(path.join(dir, n), "utf8"))));
    },
    async get(id) {
      try { return JSON.parse(await fs.readFile(file(id), "utf8")); } catch { return null; }
    },
    async put(o) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(o.id), JSON.stringify(o)); },
    async del(id) { await fs.rm(file(id), { force: true }); },
  };
}
