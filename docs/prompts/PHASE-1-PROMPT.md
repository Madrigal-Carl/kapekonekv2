# KapeKonek — Phase 1 Build Prompt (guests & buyers)

> Order chat was removed later by Change 01 (`docs/prompts/CHANGE-01-REMOVE-ORDER-CHAT.md`).

You are building **KapeKonek** from scratch in this repository: a coffee marketplace for Kaluppa in Marinduque (delivery anywhere in Marinduque or pickup at Kaluppa; e-wallet or cash). Phase 1 covers everything a **guest** and a **buyer** use, plus the backend those flows need.

## 0. Read first (do not skip)

1. `CLAUDE.md`: the rules. They apply to every line you write.
2. `docs/PRODUCT-SPEC.md`: roles, permissions, models, order lifecycle, API, realtime, emails, pages, validation, commands, seeds, env.
3. `docs/DESIGN.md`: tokens, components, screen → route map, interactions.
4. `docs/design/screens/*.dc.html`: **the approved UI. Match it exactly.**
5. `_reference/` (AgriCentral): copy its patterns for config, queue, scheduler, cookies, guards, hooks and seeder. Never import from it.

Everything in these docs is decided. Don't re-ask settled questions. If something is truly missing or contradictory, list it in `docs/plans/phase-1-questions.md`, pick the most reasonable option, note your choice, and keep going.

## 1. Workflow

- Use **superpowers**: write the plan to `docs/plans/phase-1.md` (one section per milestone below, with tasks and the tests you'll write), then execute milestone by milestone.
- Work on branch `phase-1`. **Commit at the end of every milestone** (and more often if useful).
- After every milestone:
  1. `npm run lint` and `npm test` pass in both apps.
  2. `npm run migrate:fresh -- --seed` succeeds.
  3. Check every page the milestone touched with **playwright** against its `.dc.html` screen. Fix visible differences in spacing, sizes, colors, copy and states.
  4. Run `/graphify . --update`.
  5. Write a short summary of what changed in `docs/plans/phase-1.md`.
- Use **ponytail** for lean code inside the layers. The layered architecture, guards, validation, confirmation modals and queueing are required and must stay.
- Use **impeccable** only to polish within the approved screens (run `/impeccable teach` once with `docs/DESIGN.md`). Run **taste** as a final review. Neither may redesign a page.
- Before building something, check the official docs for current versions. If a library API differs from what's written here, follow the library's docs and keep the intent.

## 2. Milestones

### M0 — Scaffold & install

```bash
git init && git checkout -b phase-1        # skip init if the repo already exists
```

**Root** `package.json`:
- scripts `dev` (concurrently runs `backend dev` + `frontend dev`), `setup` (installs both apps), `lint`, `test`;
- devDependency `concurrently`.

Root `.gitignore`: `node_modules`, `.env*` (except `.env.example`), `dist`, `coverage`, `backend/storage/`, `graphify-out/`, `_reference/`, `playwright-report/`, `test-results/`.

**Backend** (`backend/`, `"type": "module"`, Node 22):
```bash
npm i express@5 mongoose zod bcrypt jsonwebtoken cookie-parser cors helmet morgan dotenv \
      bullmq ioredis cloudinary @getbrevo/brevo socket.io @socket.io/redis-adapter @faker-js/faker
npm i -D nodemon vitest supertest mongodb-memory-server eslint @eslint/js globals
```
- Scripts: `dev`, `start`, `lint`, `test`, `migrate:fresh`, `db:seed`.
- Folders: `src/{config,routes,middlewares,schemas,controllers,services,repositories,models,queues/workers,templates/email,schedulers,sockets,utils,database/{commands,seeders/data}}`, `storage/`, `tests/`.

**Frontend** (`frontend/`):
```bash
npm create vite@latest frontend -- --template react
npm i react-router-dom @tanstack/react-query axios zustand react-hook-form zod @hookform/resolvers \
      lucide-react framer-motion sonner socket.io-client embla-carousel-react embla-carousel-autoplay \
      qrcode.react react-map-gl mapbox-gl date-fns clsx tailwind-merge @fontsource/poppins
npm i -D tailwindcss @tailwindcss/vite @playwright/test
npx playwright install chromium
```
- Tailwind v4 via `@tailwindcss/vite`. No `tailwind.config.js`. Put the tokens from `docs/DESIGN.md` §2 in `src/index.css`.
- `@` alias → `src`.
- `vercel.json` with an SPA rewrite (copy from `_reference/frontend/vercel.json`).
- Folders: `src/{api,app,routes,layouts,pages,components/{ui,layout,product,order,post,auth,map},hooks,services,schemas,stores,lib,constants}`.

**Env**: create `backend/.env.example` and `frontend/.env.example` with every variable from PRODUCT-SPEC §12. Then **stop and ask me to fill in `.env`** before M1 needs real services. `MAIL_TRANSPORT=log` works without Brevo.

**Done when**: `npm run dev` starts both apps, the frontend shows a blank page in Poppins with the theme tokens loaded, and the backend serves `GET /api/health`.

### M1 — Backend core

`config/` (env with Zod, db, valkey factory, cloudinary, mail with brevo/log transports), `AppError`, `asyncHandler`, shared `validate()`, response helpers, cursor pagination helper, `cookieOptions()`, token utilities, error and 404 middleware, helmet/CORS (credentials, `CLIENT_URL`), JSON limit, morgan, BullMQ email queue and worker (inside the API), email templates (coffee look, HTML + text), Socket.IO server with Valkey adapter and the `realtime` module, the order-expiry scheduler shell, the cron route, `/api/health`, graceful shutdown.

**Done when**: unit tests cover `validate()`, the pagination helper and the error formatting, and a queued test email lands in `backend/storage/mail/`.

### M2 — Auth, roles & permissions

- Models: User, Role, Permission, Token.
- Middleware: `authenticate`, `optionalAuth`, `guestOnly`, `verified`, `role`, `can`, `canAny`.
- Valkey: the permission cache and rate limiters.
- Every auth and account endpoint from PRODUCT-SPEC §4.
- Role/permission seeder, plus a user seeder for the accounts in §11.
- Frontend:
  - axios instance (credentials, `EMAIL_NOT_VERIFIED` → `/verify-email`, `401` → clear auth), auth store, `useAuth`, `useCan`, `<Can>`;
  - guards: `StorefrontRoute`, `GuestRoute`, `ProtectedRoute`, `RoleRedirect`; `useRequireAuthAction`;
  - `AuthLayout`, plus the pages Login, Register, ForgotPassword, ResetPassword, VerifyEmail (+ confirm). Copy `Login/Register/ForgotPassword/ResetPassword/VerifyEmail.dc.html`;
  - Dashboard placeholder (`Dashboard.dc.html`), 403 and 404 pages.

**Done when**:
- tests cover password/username rules, single-use and expired tokens, `tokenVersion` invalidation, `can()` with the super-admin rule and cache clearing, `verified` for buyers versus farmers, and login throttling;
- Playwright checks: sign up as a buyer → verify page → open the link from the log mailbox → `/`; sign up as a farmer → dashboard; forgot/reset password.

### M3 — Catalog, posts & seeders

- Models: Category, Product, Setting, Post, PostComment, Reaction, Review.
- Repositories/services/endpoints: catalog, reviews, settings (`delivery.fee`, `delivery.eta`, `pickup.location`, `payment.ewallet`, `landing.heroSlides`), `/delivery/info`, `/locations` (copy `marinduque-locations.json` from `_reference`), posts (read-only).
- Commands: `migrate:fresh` (with `--seed`, refuses in production without `--force`) and `db:seed` (`--only=`), following `_reference/backend/src/seeder.js`.
- All seeders in PRODUCT-SPEC §11, including the **verified stock media** step (check every URL returns 200 with an image/video type; upload to Cloudinary idempotently; save credits to `seeders/data/media.json`).
- Frontend:
  - `Navbar` (guest/buyer, avatar dropdown) and `Footer`;
  - Landing (`Main.dc.html`), with the hero carousel from settings;
  - Products (`Products.dc.html`): URL-synced filters, `useInfiniteQuery` with an IntersectionObserver;
  - Product detail with reviews (`ProductDetail.dc.html`);
  - Post detail (`PostDetail.dc.html`, view only).

**Done when**:
- tests cover category visibility per viewer, cursor stability on the price/rating sorts, review eligibility (sold order only, one per product) and rating recompute;
- Playwright checks the landing, products, product detail and post pages against their screens, and confirms guests are redirected to login when they click Add.

### M4 — Addresses, delivery quotes, cart, checkout, orders

- Models: Address, Cart, Order, Counter.
- `src/clients/mapbox.client.js` (Directions driving distance, forward and reverse geocoding) used only by services, plus Valkey caching and the straight-line fallback (PRODUCT-SPEC §3 "Delivery fee").
- Address endpoints (max 10, one default, soft delete), `/geo/reverse`, `/geo/search`, `/delivery/quote`.
- Cart endpoints with stock flags.
- Order placement for all four method/payment combinations (PRODUCT-SPEC §3), with a server-side fee and ETA.
- The full state machine in one `orderStatus.service` with a transition table: atomic stock reserve/return; delivery vs pickup branches (out for delivery with an optional rider / ready for pickup); cash collected on *sold*; refunds for e-wallet only; the staff endpoints; the expiry sweep with its Valkey lock.
- Frontend:
  - `CartDrawer` (`CartDrawer.dc.html`: stacked Checkout/Clear, disabled Checkout while any warning shows).
  - **Addresses** page (`Addresses.dc.html`) and the **address window** (`AddressModal.dc.html`): Mapbox `MapPicker` with a draggable pin, search, "Use my location" (browser geolocation), and reverse-geocode auto-fill; municipality → barangay → postal code selects; manual entry without a pin; outside-area error; fee preview.
  - Checkout (`Checkout.dc.html`):
    - delivery/pickup cards; saved address radio cards with distance and fee; "Add new address" opens the same window;
    - pickup card + contact number;
    - payment cards: e-wallet (GCash/Maya tabs, QR from settings via `qrcode.react` with a SAMPLE badge while `isSample`, signed Cloudinary receipt upload) or cash note;
    - live summary with fee, total, destination, ETA and payment.
  - Orders (`Orders.dc.html`) and Order detail (`OrderDetail.dc.html`), plus every dialog in `Modals.dc.html` (including cancel-with-reason and delete-address).

**Done when**:
- tests cover:
  - every allowed and forbidden transition (including delivery-only and pickup-only steps);
  - the stock reserve race and rollback, and stock returned after *reserved*;
  - expiry and its race with *reserved*;
  - the fee formula and rounding, the Mapbox fallback, `ADDRESS_NEEDS_PIN`, `OUTSIDE_DELIVERY_AREA`, and that a client-sent fee is ignored;
  - the four method/payment combinations' required fields;
  - the address limit, default handling and ownership;
  - business-day ETA math (weekends skipped);
  - unit steps, purchase permission, and order-number generation.
- Playwright, delivery: verified buyer adds a new address by dropping a pin → checkout → delivery + cash on delivery → *pending* → cancel with a reason (no refund badge).
- Playwright, pickup: a second order → pickup + GCash with a receipt → *pending*.

### M5 — Chat & notifications

- Models: Conversation, Message, Notification.
- Chat endpoints, socket events, read state, closing on final statuses, Kaluppa moderation access.
- Notification creation for every event in PRODUCT-SPEC §7, plus the queued emails in §6.
- Frontend: `ChatPanel` in Order detail (real time), the navbar bell dropdown with unread count, mark-all-read and load more.

**Done when**:
- tests cover access rules (the owner buyer and Kaluppa yes; other buyers no) and that a closed chat refuses messages;
- Playwright with two browser contexts (buyer + Kaluppa via the API/socket) sees messages arrive live.

### M6 — Profile & settings

Profile (`Profile.dc.html`: avatar upload/remove, fields, username uniqueness) and Settings (`Settings.dc.html`: change email → re-verify + notice to the old address; change password → other sessions signed out). There is no side menu; the navbar dropdown is the only account navigation.

**Done when**: tests cover the email change flow and `tokenVersion` on password change, and Playwright runs both flows.

### M7 — Polish & verification

- Compare every page with its screen at 1440px and 390px widths using Playwright screenshots, and fix the differences.
- Accessibility pass: labels, focus order, keyboard use of dropdown/drawer/modals, contrast.
- Run `/impeccable` polish and audit, then the taste review. Apply fixes that keep the approved design.
- Performance: route-level lazy loading, Cloudinary `f_auto,q_auto` image sizes, lazy images, and a sensible query `staleTime`.
- Write `README.md`: setup, env, commands, seed accounts, deploy notes (Render backend with health check `/api/health`; Vercel frontend; cross-site cookies).
- Final checklist (§4) all green.

## 3. Copying the design exactly

For every page:
1. Open its `.dc.html` file (map in `docs/DESIGN.md` §5) and read the markup top to bottom.
2. Rebuild the structure as React components. Convert each inline style to Tailwind classes using the theme tokens, keeping the same pixel values (padding, gaps, font sizes, radii, widths, border colors).
3. Shared pieces (`dc-import name="Navbar"`, cards, buttons, pills, modals) become components in `components/`. Build each once and reuse it.
4. Copy the text exactly (headings, labels, helper text, empty states, button labels) unless the API supplies the value.
5. Replace the sample data in `renderVals()` with TanStack hooks. Replace photo placeholders with seeded images.
6. Rebuild the interactions listed in `docs/DESIGN.md` §6.
7. Take a Playwright screenshot of your page at 1440px. If I've exported PNGs from the canvas into `docs/design/png/`, compare against them. Otherwise compare against the `.dc.html` markup values. Fix the differences before moving on.

## 4. Final acceptance checklist

- [ ] `npm run migrate:fresh -- --seed` works on an empty Atlas database; `npm run db:seed` can run twice without duplicates.
- [ ] Guest can browse the landing, products (filters + infinite scroll), product detail with reviews, and post detail (no react/comment controls).
- [ ] Guest clicking Add, Cart or Write review → `/login?redirect=…` and back afterwards.
- [ ] Sign-up (buyer) → verify page; unverified buyer is blocked from every buyer action (UI and API `403 EMAIL_NOT_VERIFIED`); farmer signup → dashboard without verifying.
- [ ] Login works with email or username; remember me keeps the session 30 days; logout asks for confirmation.
- [ ] Buyer cart: unit steps (0.5 kg), stock warnings, remove/clear/checkout confirmations.
- [ ] Addresses: add with a pin (fields auto-fill) or by typing; edit, delete (confirm), set default; max 10; pins outside Marinduque are refused.
- [ ] Checkout supports all four combinations (delivery/pickup × e-wallet/cash) with the right required fields. The delivery fee and ETA are computed server-side and shown live. Placing an order creates *pending* and queues emails.
- [ ] Every status transition works only for Kaluppa (and the buyer's own pending cancel). Delivery orders go through *out for delivery* (with an optional rider) and pickup orders through *ready for pickup*. Stock moves only at *reserved* and comes back on cancel/reject. Pending orders expire after 3 days (scheduler + cron route).
- [ ] E-wallet orders that are cancelled, rejected or expired show "Refund pending"; marking refunded shows the reference number. Cash orders never show a refund.
- [ ] "Chat with Kaluppa" is real time and read-only after cancelled/rejected/expired; Kaluppa messages are labeled.
- [ ] Notifications dropdown: unread count, mark all read, load more, live updates.
- [ ] Profile and settings flows work; changing email requires re-verification.
- [ ] Storefront pages redirect non-buyer roles to `/dashboard/overview`.
- [ ] Every page matches its `.dc.html` screen at desktop and mobile widths.
- [ ] Lint and tests pass; no secrets in git; `.env.example` complete; README written.
