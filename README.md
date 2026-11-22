# KapeKonek

KapeKonek is a coffee marketplace with a CRM side, built for Kaluppa in Marinduque. Buyers order coffee from Kaluppa for delivery anywhere in Marinduque or for pickup at Kaluppa. They pay by GCash/Maya (with a receipt upload) or in cash. Farmers and group managers use a dashboard.

- `backend/`: Express 5 API, Socket.IO, the BullMQ email worker and the order-expiry scheduler, all in one process.
- `frontend/`: React 19 + Vite single-page app.
- `docs/`: what to build and how it should look.
  - `PRODUCT-SPEC.md`: product specification.
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

| Email (without `SEED_EMAIL_BASE`) | Username | Role | Email verified |
|---|---|---|---|
| `kapekonek.kaluppa@gmail.com` | `kaluppa` | Kaluppa (admin) | yes |
| `kapekonek.manager.santacruz@gmail.com` | `manager.santacruz` | Group Manager | yes |
| `kapekonek.farmer.approved@gmail.com` | `farmer.approved` | Farmer | yes |
| `kapekonek.farmer.unverified@gmail.com` | `farmer.unverified` | Farmer | no |
| `kapekonek.buyer@gmail.com` | `buyer` | Buyer (with addresses and orders) | yes |
| `kapekonek.buyer.unverified@gmail.com` | `buyer.unverified` | Buyer | no: blocked until verified |
| `kapekonek.buyer01@gmail.com` … `kapekonek.buyer20@gmail.com` | `buyer01` … `buyer20` | Buyers (reviewers) | yes |

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
