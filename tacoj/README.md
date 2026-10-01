# Taco J / Taco Joint PH — website

One-page site built with Next.js 14 (App Router), React and Tailwind CSS.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Where to update content

Everything editable lives in **`src/data/site.ts`**:

| What | Where in `site.ts` |
|---|---|
| Logo | `brand.logo` — put the file in `public/images/` and set e.g. `"/images/logo.svg"` |
| Instagram handle / link, full-menu link | `brand.instagramHandle`, `brand.instagramUrl`, `brand.fullMenuUrl` |
| Hero photo | `brand.heroImage` |
| "Hours may change" note | `brand.updatesNote` |
| Branch address, phones, mood copy | `locations[…]` |
| Opening hours | `locations[…].hours` — 24h `"HH:MM"`; a close time earlier than the open time means after midnight (e.g. `"02:00"`) |
| Google Maps links | `locations[…].mapsUrl` (currently a Maps search — replace with the official share link) |
| Online ordering / reservations | `locations[…].orderUrl`, `reserveUrl` — buttons appear only when filled |
| Branch photos | `locations[…].image` |
| Menu categories & items | `menu` — `price: ""` shows "Ask in store"; `availableAt`: `"both" \| "liwa" \| "sbma"`; `image` for a real photo |
| Instagram gallery | `instagramPosts` — `image` + optional exact post `href` |

Empty `image` fields show branded illustration placeholders. "Today's hours" and open/closed status are computed live in Manila time (`Asia/Manila`).
