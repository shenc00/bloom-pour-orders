# Bloom Pour – pre-order app

Mobile-friendly order page for Bloom Pour pour-over coffee, built for Netlify.

- **`/`** – customers pick cups (stock shown live), enter name and contact number, choose collection or free delivery (4+ cups, within Ki Residences), pick a time window, then see the PayNow QR and amount to pay.
- **`/admin`** – password-protected order list: totals per coffee, paid / collected ticks, cancel, CSV download.
- Stock limits (Gesha 3, Landrace 3, Kenya 10) are enforced on the server, so two people can't take the last cup.
- Orders are stored in Netlify Blobs. No database or Google account needed.

## Deploy on Netlify
1. Push this repo to GitHub (`shenc00/bloom-pour-orders`).
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings are read from `netlify.toml` (no build command, publish `public`).
3. **Site configuration → Environment variables**: add `ADMIN_PASSWORD` with a password of your choice, then redeploy.
4. Share the site URL with customers. Open `your-site.netlify.app/admin` to see orders.

## Editing
- Menu, prices, stock caps, time windows, delivery rule, contact: `netlify/functions/lib/menu.mjs`
- PayNow QR: replace `public/paynow-qr.png`. **The current QR expires 5 Oct 2026.**
- Look and feel: the `<style>` block in `public/index.html`.
- To reset stock/orders for a new batch, delete the `orders` store in Netlify → **Blobs**.

## Local development
```
npm install
npm test        # runs the order/stock logic tests
npm run dev     # http://localhost:8888 (orders saved in ./.data)
```
`npx netlify dev` also works for full Netlify emulation.
