// Tiny local server: serves /public and routes /api/* to the Netlify functions.
// Use `npm run dev`, or `npx netlify dev` for the full Netlify emulation.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const routes = {};
for (const f of ["menu", "order", "admin", "cancel", "coffees", "qr"]) {
  const m = await import(`../netlify/functions/${f}.mjs`);
  routes[m.config.path] = m.default;
}
const types = { ".html": "text/html", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" };
const port = process.env.PORT || 8888;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (routes[url.pathname]) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await routes[url.pathname](new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!path.extname(p)) p += ".html"; // /admin, /coffees
  try {
    const data = await fs.readFile(path.join("public", p));
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(data);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(port, () => console.log(`Bloom Pour running on http://localhost:${port}`));
