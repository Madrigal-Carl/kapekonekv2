# KapeKonek — Step-by-Step Build Guide

For when **SETUP.md steps 1–6 are done**: tools installed, accounts created, project folder made, Claude Code installed, skills installed. This guide takes you from there to a finished Phase 1.

Phase 1 is built in **8 milestones (M0–M7)**. For each one you send Claude Code one message, let it work, do a short check yourself, then move on.

---

## Step 1 — Put the latest kit in your project folder

1. Unzip `kapekonek-kit-v4.zip`.
2. Copy everything inside its `kapekonek/` folder into your project folder (`C:\Web Projects\TEMP\kapekonek`), replacing the old files:
   - `CLAUDE.md`, `SETUP.md`, `BUILD-GUIDE.md`
   - the whole `docs/` folder (replace it, so old screens don't linger)
3. **Don't delete** `_reference/` or the `.claude/` folder (your project skills from step 6 live there).

Your folder should now look like:
```
kapekonek/
├── .claude/            ← skills you installed (keep)
├── _reference/         ← AgriCentral backend/ + frontend/ (keep)
├── CLAUDE.md
├── SETUP.md
├── BUILD-GUIDE.md
└── docs/
    ├── PRODUCT-SPEC.md
    ├── DESIGN.md
    ├── design/screens/   (24 files)
    └── prompts/PHASE-1-PROMPT.md
```

## Step 2 — Have your keys ready

Open a notepad with these. You'll paste them into `.env` files after M0:

| Key | From |
|---|---|
| `MONGO_URI` | Atlas connection string, with `/kapekonek` before the `?` |
| `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD` | Aiven Valkey |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary |
| `BREVO_API_KEY`, `EMAIL_FROM` | Brevo. Optional: `MAIL_TRANSPORT=log` works without it |
| `KALUPPA_ORDERS_EMAIL` | any inbox for new-order notices |
| `MAPBOX_ACCESS_TOKEN` | Mapbox token for the **backend** (no URL restriction) |
| `VITE_MAPBOX_TOKEN` | Mapbox **public** `pk.` token for the frontend |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` | generate each with the command below |

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Step 3 — Start Claude Code

In VS Code: **File › Open Folder** → your `kapekonek` folder → **Terminal › New Terminal**:
```powershell
claude
```

## Step 4 — Send the first message (plan + M0)

```
Read CLAUDE.md, docs/PRODUCT-SPEC.md, docs/DESIGN.md and docs/prompts/PHASE-1-PROMPT.md.
The approved UI is in docs/design/screens/ (exported from Claude Design). Every page must
match its screen exactly: layout, spacing, sizes, colors, copy and states.
Use superpowers to write the plan to docs/plans/phase-1.md and show me a short summary.
Wait for my OK before starting Milestone 0.
```

**Then:**
- Read the summary. Check that it covers delivery + pickup, e-wallet + cash, addresses with a map pin, the 3–5 business day ETA, the 3-day expiry, and that there are no stations.
- Reply `Plan OK. Start M0. Stop when the .env.example files are ready.`
- Claude asks permission before running commands (npm installs, git). Approve them. When it asks to allow a command repeatedly, approve the safe ones (npm, npx, git, node) so it doesn't keep asking.

## Step 5 — Fill in the `.env` files (after M0)

When Claude stops after M0:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Open both files and paste your values from Step 2. For local development:
- `backend/.env`: `NODE_ENV=development`, `PORT=5000`, `CLIENT_URL=http://localhost:5173`, `VALKEY_TLS=true` (Aiven), `MAIL_TRANSPORT=log` (switch to `brevo` later).
- `frontend/.env`: `VITE_API_URL=http://localhost:5000/api`, `VITE_SOCKET_URL=http://localhost:5000`.

Then tell Claude: `Env is ready. Verify the connections, then continue with M1.`

## Step 6 — Build milestone by milestone

**For each milestone:**
1. Send the message in the table below.
2. Let Claude work. It plans, writes code and tests, runs lint and tests, checks the pages against the screens with Playwright, runs graphify, and commits.
3. Do the quick check yourself.
4. If anything's off, say so in plain words (e.g. `The cart drawer's buttons aren't stacked like CartDrawer.dc.html`).
5. When it's good, run `/clear` to start fresh, then send the next message.

| # | Send this | It builds | Check yourself |
|---|---|---|---|
| M1 | *(continues from Step 5)* | Backend core: config, errors, validation, queue, sockets, scheduler shell, health | `http://localhost:5000/api/health` shows Mongo + Valkey OK |
| M2 | `Continue KapeKonek Phase 1 from docs/plans/phase-1.md. Start M2. Re-read CLAUDE.md and the auth screens first.` | Sign in, sign up, verify, forgot/reset, roles & permissions, dashboard placeholder | Sign up as a buyer → verify-email page. The link is in `backend/storage/mail/` (log mode). Sign up as a farmer → dashboard |
| M3 | `Continue … Start M3. Re-read the Main, Products, ProductDetail, PostDetail, Navbar and Footer screens first.` | Catalog, posts, seeders + real stock photos, landing, products, product & post pages | `cd backend`, then `npm run migrate:fresh -- --seed`. Browse `/`, `/products`, a product, a post |
| M4 | `Continue … Start M4. Re-read the CartDrawer, Checkout, Addresses, AddressModal, Orders, OrderDetail and Modals screens first.` | Addresses + map pin, delivery fee (Mapbox), cart, checkout (4 combos), orders, statuses, expiry | Log in as `buyer@kapekonek.test`: add an address with a pin → checkout with delivery + COD → see it in Orders |
| M5 | `Continue … Start M5.` | Notifications, live order updates, status emails | Move one of your orders to *out for delivery* as Kaluppa (Step 8); the bell and the order page update live |
| M6 | `Continue … Start M6. Re-read the Profile and Settings screens first.` | Profile, settings (email/password) | Upload an avatar; change your password; the other browser gets logged out |
| M7 | `Continue … Start M7 (polish & verification) and finish with the final checklist in PHASE-1-PROMPT.md §4.` | Design comparison at desktop + mobile, accessibility, impeccable/taste pass, README | Click through everything on your phone width too |

> `Continue …` means: `Continue KapeKonek Phase 1 from docs/plans/phase-1.md.`

## Step 7 — Make sure it matches the design

Whenever a page doesn't look right, point Claude at its screen file:
```
Compare /checkout with @docs/design/screens/Checkout.dc.html at 1440px and 390px.
List every difference (spacing, font sizes, colors, borders, copy, states), then fix them.
```
You can also open the canvas next to the running app: https://claude.ai/artifact/4KyhXQ9d8BtaDgg61uLz3h

## Step 8 — Try every order status (no Kaluppa screens yet)

Ask Claude:
```
Give me PowerShell commands to log in as kaluppa@kapekonek.test and move my latest order through
reserved → processing → out_for_delivery (rider Jun, 09175550102) → sold. Then do the same for a
pickup order with ready_for_pickup, and show how to reject one and mark its refund.
```
Watch the buyer's order page, notifications and emails update.

## Step 9 — Run it yourself any time

```powershell
npm run dev
```
Frontend: http://localhost:5173 · Seed accounts (password `Password123!`):

| Account | Lands on |
|---|---|
| `buyer@kapekonek.test` | storefront (has 3 saved addresses and sample orders) |
| `buyer.unverified@kapekonek.test` | verify-email page |
| `kaluppa@kapekonek.test`, `manager@kapekonek.test`, `farmer1@kapekonek.test` | dashboard placeholder |

To reset the data: `cd backend`, then `npm run migrate:fresh -- --seed`.

## Step 10 — Deploy (when M7 is done)

See **SETUP.md §10**: backend on Render (health check `/api/health`), frontend on Vercel, and all env variables set in both dashboards. Before going live, replace the placeholders:
- Kaluppa's exact pin and opening hours;
- the e-wallet account name, number and QR;
- the delivery fee values (seed settings).

---

## Change prompts (after the build)

Each one is a single Claude Code session. Copy the updated kit files in first (CLAUDE.md, BUILD-GUIDE.md, SETUP.md, docs/; keep your code, `_reference/`, `.claude/` and `docs/plans/phase-1.md`), run `/clear`, then send the line.

| Change | Send |
|---|---|
| 01 · remove order chat | done |
| 02 · no eyebrow bar | done |
| 03 · search selects, map zoom, upload limits, review rules, cart quantity fix | `Read CLAUDE.md and docs/prompts/CHANGE-03-SELECTS-MAP-ZOOM-UPLOADS-REVIEWS-CART.md, then carry out Change 03.` |

## Tips while it builds

- **One milestone per session.** Run `/clear` between them, and the "Continue … Start Mx" message brings it back on track.
- **It drifted or forgot a rule?** Say `Re-read CLAUDE.md and follow it` and name what was wrong.
- **An error in the terminal or browser?** Paste it in as is; Claude will trace it.
- **Want to check progress?** Look in `docs/plans/phase-1.md`; the summary after each milestone is there. `git log --oneline` shows the milestone commits.
- **Changed the design on the canvas later?** Re-download the changed `.dc.html` files into `docs/design/screens/` and say `The design for <Screen> changed. Update the page to match.`
- **PowerShell 5.1** doesn't support `&&`. Run commands one per line, as written here.
