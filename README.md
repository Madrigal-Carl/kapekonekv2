# KapeKonek

KapeKonek is a coffee marketplace with a CRM side, built for Kaluppa in Marinduque. Kaluppa is the only seller and does all fulfilment: delivery anywhere in Marinduque (fee from the road distance) or pickup at Kaluppa in Pantayin, Santa Cruz. Customers pay by e-wallet (QR and a receipt upload; only GCash is enabled for now, set in Settings) or in cash.

| Role | Uses | Home after sign-in |
|---|---|---|
| Buyer | The storefront: coffee, cart, checkout, orders, addresses | `/` |
| Farmer | The dashboard: farms, trees, harvests, selling beans to Kaluppa (5 kg in total until approved), the store for fertilizer and seedlings, Inbox, Hub, Farm Map. Must verify their email. | `/dashboard/overview` |
| Group Manager | The dashboard for one association: approves farmers and does everything for them (records, beans), Inbox, Hub, Farm Map, Reports | `/dashboard/overview` |
| Kaluppa | Everything: Group Managers, associations, its own farms, the bean review, orders, inventory, reviews, settings, reports with CSV, the audit log | `/dashboard/overview` |

- `backend/`: Express 5 API, Socket.IO, the BullMQ email worker and the order-expiry scheduler, all in one process.
- `frontend/`: React 19 + Vite single-page app.
- `docs/`: what to build and how it should look.
  - `PRODUCT-SPEC.md`: product specification (Phase 1, the storefront).
  - `PHASE-2-SPEC.md`: the dashboard (Phase 2).
  - `DESIGN.md`: design rules.
  - `design/screens/*.dc.html`: the approved screens.

## Requirements

- Node 22 or later.
- A MongoDB Atlas database.
- A Valkey or Redis server (Aiven, or local Docker: `docker run -p 6379:6379 valkey/valkey`).
- Cloudinary.
- Mapbox: a server token plus a public `pk.` token.
- Brevo, for real email. Local development can write emails to disk instead.

## Setup

```bash
npm run setup                          # installs root, backend and frontend
cp backend/.env.example backend/.env   # fill in every value (comments explain each one)
cp frontend/.env.example frontend/.env
npm --prefix backend run migrate:fresh -- --seed   # drop everything, create indexes, seed
npm run dev                            # API on :5000, web on :5173
```

- `backend/src/config/env.js` validates every variable at boot. A missing or malformed value stops the server with a message naming it.
- Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `MAIL_TRANSPORT=log` writes every email to `backend/storage/mail/` instead of sending it through Brevo.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API (nodemon) and web (Vite) together |
| `npm run lint` | ESLint in both apps |
| `npm test` | Vitest in both apps. The backend uses an in-memory MongoDB and ioredis-mock, so it needs no services. |
| `npm run test:e2e` | Playwright. Starts its own API on :5100 and web on :5174 against the seeded database in `backend/.env`. Stop anything already on those ports first. |
| `npm --prefix backend run migrate:fresh -- --seed` | Drop the database, rebuild indexes, then seed |
| `npm --prefix backend run db:seed` | Seed again without dropping. Safe to run twice: everything is upserted. |

## Seed accounts

Every account is a Gmail address with the password `KapeKonek@123` (`SEED_DEFAULT_PASSWORD`). You can sign in with the email or the username; `migrate:fresh -- --seed` prints this table.

- Leave `SEED_EMAIL_BASE` empty and the emails are `kapekonek.<username>@gmail.com`. The mail worker never emails these accounts: it writes the message to `backend/storage/mail/` with a `skipped-seed` note.
- Set `SEED_EMAIL_BASE=yourname@gmail.com` and they become `yourname+<username>@gmail.com`, so every email really reaches your inbox.

| Username | Who | Lands on |
|---|---|---|
| `kaluppa` | Kaluppa (admin), branch pin and hours set | `/dashboard/overview` |
| `manager.santacruz` | Group Manager, Santa Cruz Coffee Growers (4 farmers waiting); manages the Kaluppa Demo Farm | `/dashboard/overview` |
| `manager.boac` | Group Manager, Boac Highland Farmers | `/dashboard/overview` |
| `manager.unassigned` | Group Manager with no association | `/dashboard/overview` (empty state) |
| `manager.unverified` | Created by Kaluppa, email not verified | `/verify-email` (created variant) |
| `farmer.approved` | Approved farmer (Rodel), farms, beans, farm-supply orders and chats | `/dashboard/overview` |
| `farmer.pending` | Waiting for approval, 3 of 5 kg used | overview with the banner |
| `farmer.new` | Email verified, no association | the association window |
| `farmer.rejected` | Request rejected | overview with the reason |
| `farmer.transfer` | In Boac, asking to move to Santa Cruz | `/dashboard/overview` |
| `farmer.unverified` | Created by a Group Manager, email not verified | `/verify-email` (created variant) |
| `buyer` | Buyer (Juana) with addresses and orders in every status | `/` |
| `buyer.unverified` | Buyer, blocked until verified | `/verify-email` |
| `buyer01` … `buyer20` | Buyers who left reviews | `/` |

Emails are `kapekonek.<username>@gmail.com` (or `yourname+<username>@gmail.com`). The seed also fills farms in all 6 towns, tree groups in every stage, 12 months of harvests, bean listings in every status (one approved listing expires within a day), chats with every receipt state, Hub posts (one portrait photo, one video) with views for the landing top 3, and about 60 audit entries.

## Background jobs

All run inside the API process; nothing else needs deploying.

| Job | When | What |
|---|---|---|
| Email worker (BullMQ `email`) | on demand | Sends every email through Brevo (or writes it to `backend/storage/mail/`), 3 attempts with backoff. Skips seed accounts unless `SEED_EMAIL_BASE` is set. |
| Order expiry | every `ORDER_EXPIRY_INTERVAL_MINUTES` | Expires orders not confirmed in 3 days and releases their stock. Also callable from cron: `POST /api/cron/expire-orders`. |
| `beans:expire` (BullMQ `jobs`) | hourly | Expires approved bean listings not brought in within 7 days. |
| `posts:top3` (BullMQ `jobs`) | hourly | Ranks the 3 most-viewed Hub posts of the last 30 days for the landing page. |

## Deploy

### Backend on Render (one web service)

1. Root directory `backend`, build `npm install`, start `npm start`, health check path **`/api/health`**.
2. Environment:
   - Every variable from `backend/.env.example`, with `NODE_ENV=production`, `MAIL_TRANSPORT=brevo` and `CLIENT_URL=https://<your-app>.vercel.app` (no trailing slash).
   - CORS and Socket.IO accept only `CLIENT_URL`.
3. Behaviour in the one process:
   - The email worker and the expiry scheduler run inside the web process.
   - On `SIGTERM` the process closes HTTP, Socket.IO, the scheduler, the worker, the queue, Valkey and Mongo, in that order.
4. Free instances sleep, so also call the expiry job from an external cron (for example every 15 minutes):
   ```
   POST https://<api>.onrender.com/api/cron/expire-orders
   x-cron-secret: <CRON_SECRET>
   ```

### Frontend on Vercel

- Root directory `frontend`, framework Vite. `vercel.json` rewrites every path to `index.html`.
- Set `VITE_API_URL=https://<api>.onrender.com/api`, `VITE_SOCKET_URL=https://<api>.onrender.com` and `VITE_MAPBOX_TOKEN` (a public `pk.` token, URL-restricted to your Vercel and local URLs).

### Cross-site cookies

The API and the SPA live on different sites, so in production the auth cookies are set with `secure: true` and `sameSite: 'none'`. In development they use `sameSite: 'lax'`. Both settings come from one `cookieOptions()` helper.

This means:

- The API must be served over HTTPS.
- The browser must allow third-party cookies for the API domain.
- The API trusts one proxy hop (`trust proxy 1`), which is what Render uses.

If you put both apps behind one domain (for example `api.example.com` and `app.example.com`), cookies become same-site and keep working with the same settings.

## Data and credits

- **Marinduque boundaries** (`backend/src/data/boundaries/`): municipality and barangay polygons from [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps) v1.1.1 (PSGC 2026-3q, MIT). The underlying boundaries are © NAMRIA and PSA, published through OCHA's [Philippines COD-AB](https://data.humdata.org/dataset/cod-ab-phl) under [CC BY-IGO 3.0](http://creativecommons.org/licenses/by/3.0/igo/legalcode). The maps show this credit in their attribution control. Rebuild with `node backend/scripts/build-boundaries.js <unzipped topojson-hires>/topojson`.
- **Maps**: © Mapbox, © OpenStreetMap contributors.
