# Bloom Pour – pre-order app

Mobile-friendly order page for Bloom Pour pour-over coffee, built for Netlify.

- **`/`** – customers pick cups (stock shown live), enter name and contact number, choose collection or free delivery (4+ cups, within Ki Residences), pick a time window, then see the PayNow QR and amount to pay.
- **`/coffees`** – the whole coffee library for customers (name, origin, process, roast, taste, note, roastery). Coffees not on sale this round are greyed out. Brew method is never shown.
- **`/admin`** – password-protected, three tabs:
  - **Orders**: per sale (current and past), totals per coffee, paid / collected ticks, cancel, CSV download. A revenue split bar shows coffee cost vs gross profit. Each order has a **Promo $** box for a discount: it reduces that order's revenue and profit. Cost comes from the library cost prices saved with the sale (set them before publishing; the original Sunday 4/10 sale uses current library costs).
  - **Coffee library**: add, edit and delete coffees, including a private brew method and private cost price. The sales price pre-fills Sale setup.
  - **Sale setup**: date, hours, time windows, and which library coffees are on sale with price and cups. *Publish as new sale* starts fresh stock and orders; *Update current sale* edits the live one.
  - **PayNow QR**: upload a new QR image and set its expiry date. A warning banner shows in admin for the last 7 days and after expiry.
- Stock limits are per sale and enforced on the server, so two people can't take the last cup.
- Orders are stored in Netlify Blobs. No database or Google account needed.

## Deploy on Netlify
1. Push this repo to GitHub (`shenc00/bloom-pour-orders`).
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings are read from `netlify.toml` (no build command, publish `public`).
3. **Site configuration → Environment variables**: add `ADMIN_PASSWORD` with a password of your choice, then redeploy.
4. Share the site URL with customers. Open `your-site.netlify.app/admin` to see orders.

## Editing
- Each sale (date, hours, coffees, prices, cups, time windows): `/admin` → Sale setup. No redeploy needed.
- Fixed settings (contact number, estate, free-delivery rule) and the fallback menu used before the first sale is published: `netlify/functions/lib/menu.mjs`. The coffee library is pre-loaded once from this file.
- PayNow QR: change it in `/admin` → PayNow QR (no redeploy). `public/paynow-qr.png` is only the fallback until you upload one; its expiry (5 Oct 2026) is `qrExpiry` in `menu.mjs`.
- Look and feel: the `<style>` block in `public/index.html`.
- Orders from earlier sales are kept (Blobs stores `orders`, `library`, `sales`). Publishing a new sale resets stock automatically; nothing needs deleting.

## Local development
```
npm install
npm test        # runs the order/stock logic tests
npm run dev     # http://localhost:8888 (orders saved in ./.data)
```
`npx netlify dev` also works for full Netlify emulation.
