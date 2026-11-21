# KapeKonek Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything a guest and a buyer use in KapeKonek (storefront, auth, addresses with a Mapbox pin, cart, checkout for delivery/pickup × e-wallet/cash, orders with the full status machine, notifications with live order updates, profile, settings) plus the backend those flows need, matching the approved `.dc.html` screens.

**Architecture:** Two apps in one repo. `backend/` is one Express 5 process that also runs the BullMQ email worker, the Socket.IO server (Valkey adapter) and the order-expiry scheduler; requests flow route → auth guards → `validate()` → controller → service → repository → model. `frontend/` is a React 19 + Vite SPA; data flows Zod form → TanStack Query hook → service → axios.

**Tech Stack:** Node ≥22, Express 5, Mongoose, Zod, BullMQ + ioredis (Valkey), Socket.IO, Cloudinary, Brevo, Mapbox (server: Directions + Geocoding; client: `react-map-gl` + `mapbox-gl`), Vitest + Supertest + mongodb-memory-server; React 19, Vite, Tailwind v4 (`@tailwindcss/vite`), TanStack Query, Zustand, react-hook-form, Playwright.

**Spec:** `CLAUDE.md`, `docs/PRODUCT-SPEC.md`, `docs/DESIGN.md`, `docs/prompts/PHASE-1-PROMPT.md`, `docs/design/screens/*.dc.html`. Open questions and the choices made: `docs/plans/phase-1-questions.md`.

## Global Constraints

- JavaScript ES modules both sides, no TypeScript; JSDoc on public service and repository functions.
- Backend flow: `route → authenticate/optionalAuth → verified → can()/role() → validate() → controller → service → repository → model`. Only repositories import models. Outside APIs only in `src/clients/`, only called by services. Sockets only through `realtime.toUser`, and only for `notification:new` and `order:updated` (no order chat — Changes 01/02).
- Eyebrow labels are text only: no bar, dash or line before them, on light or dark (Change 02, DESIGN.md §3).
- Response: `{ success, message?, data, meta? }` / `{ success:false, message, code, errors }`; `errors` is a flat `field → message` map. Codes: `VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, EMAIL_NOT_VERIFIED, NOT_FOUND, CONFLICT, RATE_LIMITED, SERVER_ERROR` (+ domain codes `ADDRESS_NEEDS_PIN`, `OUTSIDE_DELIVERY_AREA` at 422).
- Money = integer centavos; line total `Math.round(priceCentavos * quantity)`; format only on the frontend with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
- Quantity: `kg` → step 0.5, min 0.5; `pack`/`piece` → integers, min 1. Same Zod rule both sides.
- Lists use cursor pagination (`?cursor=&limit=` → `meta.nextCursor`, `meta.hasMore`) via one helper encoding `(sortValue, _id)`.
- Password ≥8 with a letter, a digit and a symbol. Username `^[a-z0-9._]{3,30}$`. Names 1–50. Phone `^09\d{9}$` after removing spaces.
- Cookies via one `cookieOptions()`: `accessToken` 15 min; `refreshToken` 30 days with remember-me else session; httpOnly; prod `secure:true, sameSite:'none'`, dev `sameSite:'lax'`. Refresh tokens carry `tokenVersion`.
- Permission cache `perm:user:<id>`, TTL 600 s; `kaluppa` passes every `can()`. Features check permissions, never `role === 'buyer'`; purchasability = category `purchasePermission`.
- Buyers must be verified for every authenticated buyer action (`403 EMAIL_NOT_VERIFIED`); other roles may act unverified.
- Every email goes through BullMQ (3 attempts, exponential backoff); user text escaped in templates. `MAIL_TRANSPORT=log` writes to `backend/storage/mail/`.
- Shutdown order: HTTP → Socket.IO → scheduler → worker → queue → Valkey → Mongo.
- Mapbox Directions/Geocoding only on the backend (`MAPBOX_ACCESS_TOKEN`); delivery fee always recomputed server-side.
- Throttles: login 5/min, verification resend 1/min, `/geo/reverse` 30/min, username endpoints and forgot-password throttled.
- UI: match the `.dc.html` screen exactly; colors only via `@theme` tokens in `frontend/src/index.css` (no hex in components); mobile-first; skeleton/empty/error on every list; focus rings; focus-trapped, Esc-closable modals/drawers/menus; touch targets ≥44px.
- Confirmation modals: logout, remove cart item, clear cart, proceed to checkout, place order, cancel order (with reason), delete address.
- Account-gated actions go through `useRequireAuthAction()` (guest → `/login?redirect=<path>`; unverified buyer → `/verify-email`).
- All times that make a calendar date (order number date, business-day ETA) use `Asia/Manila`.

## Review Focus

1. **Double "Place order"** (double click, two tabs): exactly one order; the second request gets `409 CONFLICT` "Your cart is empty". → test in Task 4.4.
2. **Server clock in UTC** (Render): order number date and ETA business days use Manila dates — an order at `2026-11-23T17:00Z` (Tue 01:00 Manila) is `KK-20261124-…`. → test in Task 4.1 (ETA) and 4.4 (order number).
3. **Open redirect** via `?redirect=//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:…`: ignored, falls back to role home. → test in Task 2.4.
4. **Several requests hit 401 at once** after the access token expires: one `/auth/refresh` call, all requests retried; a failed refresh clears auth once. → test in Task 2.4.
5. **Cart goes stale** between viewing and placing (price changed, product deactivated, stock dropped): the order uses current server prices; inactive/over-stock lines refuse the order with `409` listing the lines. → test in Task 4.4.

## Milestone wrap-up (run after every milestone)

- [ ] `npm run lint` and `npm test` at the root (both apps) → exit 0.
- [ ] From M2 on: `npm --prefix backend run migrate:fresh -- --seed` → exit 0.
- [ ] Playwright: every page the milestone touched, at 1440 px and 390 px, compared with its `.dc.html` values (spacing, sizes, colors, copy, states); fix differences.
- [ ] `/graphify . --update`.
- [ ] Append a "Milestone summary" under that milestone below.
- [ ] Commit on `phase-1`: `feat(m<N>): <summary>`.

## File structure (decided once)

```
backend/src/
  app.js                 express app (no listen) — imported by tests
  server.js              boot: db, valkey, sockets, worker, scheduler, listen, shutdown
  config/                env.js, db.js, valkey.js, cloudinary.js, mail.js
  clients/               mapbox.client.js, cloudinary.client.js (upload/destroy)
  middlewares/           auth.middleware.js, permission.middleware.js, verified.middleware.js,
                         validate.js, rateLimit.middleware.js, error.middleware.js
  schemas/               rules.js + <resource>.schema.js
  routes/ controllers/ services/ repositories/ models/   one file per resource
  queues/                email.jobs.js, email.queue.js, workers/email.worker.js
  templates/email/       layout.js + one file per job
  schedulers/            orderExpiry.scheduler.js
  sockets/               index.js (io + adapter + handshake), realtime.js
  utils/                 AppError.js, asyncHandler.js, response.js, pagination.js, cookies.js,
                         tokens.js, escapeHtml.js, businessDays.js, manilaDate.js
  constants/             permissions.js (slugs + role matrix), orderStatus.js
  data/                  marinduque-locations.json, postal-codes.js
  database/commands/     migrateFresh.js, dbSeed.js
  database/seeders/      <name>.seeder.js, index.js (ordered registry), data/ (media.json, products.js…)
backend/tests/           <area>.test.js, helpers/ (memory mongo, app agent, login helper)
frontend/src/
  api/axios.js  app/ (App.jsx, providers.jsx, queryClient.js)  routes/ (AppRouter + guards)
  layouts/ (StorefrontLayout, AuthLayout, AccountLayout, DashboardLayout)
  pages/<area>/  components/{ui,layout,product,order,post,auth,map}
  hooks/ services/ schemas/ stores/ lib/ constants/
frontend/e2e/            Playwright specs + helpers (mailbox reader, api login)
```

---

## M0 — Scaffold & install

### Task 0.1: Git and root workspace

**Files:** Create `package.json`, `.gitignore`.

- [ ] **Step 1:** `git init && git checkout -b phase-1` (repo did not exist).
- [ ] **Step 2:** Root `package.json` (`private`, `engines.node >=22`), devDependency `concurrently`. Scripts:
  - `dev`: `concurrently -n api,web -c yellow,cyan "npm --prefix backend run dev" "npm --prefix frontend run dev"`
  - `setup`: `npm install && npm --prefix backend install && npm --prefix frontend install`
  - `lint`: `npm --prefix backend run lint && npm --prefix frontend run lint`
  - `test`: `npm --prefix backend test && npm --prefix frontend test`
  - `test:e2e`: `npm --prefix frontend run test:e2e`
- [ ] **Step 3:** `.gitignore`: `node_modules`, `.env*`, `!.env.example`, `dist`, `coverage`, `backend/storage/`, `graphify-out/`, `_reference/`, `playwright-report/`, `test-results/`, `.claude/settings.local.json`.

### Task 0.2: Backend scaffold with `/api/health`

**Files:** Create `backend/package.json`, `backend/eslint.config.js`, `backend/src/app.js`, `backend/src/server.js`, `backend/tests/health.test.js`, folder tree with `.gitkeep`.

**Interfaces:** Produces `app` (default export of `src/app.js`, an Express app without `listen`) — every later supertest imports it.

- [ ] **Step 1:** `npm i` / `npm i -D` the packages listed in PHASE-1-PROMPT M0 (latest versions). Scripts: `dev: nodemon src/server.js`, `start: node src/server.js`, `lint: eslint .`, `test: vitest run`, `migrate:fresh: node src/database/commands/migrateFresh.js`, `db:seed: node src/database/commands/dbSeed.js` (command files arrive in Task 2.1).
- [ ] **Step 2: failing test** `tests/health.test.js`: `GET /api/health` → 200, body `{ success: true, data: { status: 'ok' } }`.
- [ ] **Step 3:** `src/app.js` with helmet, cors, `express.json`, `GET /api/health`; `src/server.js` listens on `process.env.PORT || 5000` (env validation comes in M1).
- [ ] **Step 4:** `npm test` and `npm run lint` pass.

### Task 0.3: Frontend scaffold with tokens and Poppins

**Files:** `frontend/` from `create-vite` (react template), `vite.config.js`, `src/index.css`, `src/main.jsx`, `src/App.jsx`, `vercel.json`, `src/lib/format.js`, `src/lib/format.test.js`, folder tree with `.gitkeep`.

**Interfaces:** Produces `formatPeso(centavos: number) => string` in `src/lib/format.js`.

- [ ] **Step 1:** Scaffold, install the PHASE-1-PROMPT M0 packages plus `vitest` (frontend `npm test`), `npx playwright install chromium`.
- [ ] **Step 2:** `vite.config.js`: `react()`, `tailwindcss()`, alias `@` → `src`. No `tailwind.config.js`. Remove the template's demo CSS/assets.
- [ ] **Step 3:** `src/index.css` = DESIGN.md §2 block verbatim, plus the screens' `<helmet>` base: `body { margin:0; font-family: var(--font-sans); color: var(--color-ink); background: white; -webkit-font-smoothing: antialiased }`, links roast/roast-hover, `:focus-visible` 2px roast outline with 2px offset. `main.jsx` imports `@fontsource/poppins/{400,500,600,700}.css`.
- [ ] **Step 4: failing test** `formatPeso(123456)` → `'₱1,234.56'`; `formatPeso(5000)` → `'₱50.00'`. Implement with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
- [ ] **Step 5:** scripts `test: vitest run`, `test:e2e: playwright test`; `vercel.json` copied from `_reference/frontend/vercel.json`.

### Task 0.4: Env examples and boot check

**Files:** `backend/.env.example`, `frontend/.env.example`.

- [ ] **Step 1:** Every variable in PRODUCT-SPEC §12 with the spec's defaults (`ACCESS_TOKEN_EXPIRES=15m`, `MAIL_TRANSPORT=log`, `EMAIL_FROM_NAME=KapeKonek`, `VALKEY_USERNAME=default`, `VALKEY_TLS=true`, `CLOUDINARY_ROOT_FOLDER=kapekonek`, `ORDER_EXPIRY_DAYS=3`, `ORDER_EXPIRY_INTERVAL_MINUTES=5`, `SEED_DEFAULT_PASSWORD=Password123!`); local dev values `PORT=5000`, `CLIENT_URL=http://localhost:5173`, `VITE_API_URL=http://localhost:5000/api`, `VITE_SOCKET_URL=http://localhost:5000`; secrets blank.
- [ ] **Step 2:** `npm run dev` at root → both start; `curl localhost:5000/api/health` → 200; Playwright screenshot of `localhost:5173` shows a blank page whose computed `font-family` starts with `Poppins` and `--color-roast` resolves to `#7B4A2A`.
- [ ] **Step 3:** lint + test at root; commit `chore(m0): scaffold backend, frontend and root workspace`. **Stop; ask the user to fill in `.env`.**

---

## M1 — Backend core

### Task 1.1: Env, connections, mail transport

**Files:** `config/env.js`, `config/db.js`, `config/valkey.js`, `config/cloudinary.js`, `config/mail.js`; test `tests/env.test.js`.

**Interfaces:** `env` (frozen parsed object); `parseEnv(source) => env` (throws listing every bad key); `createValkeyConnection(name) => IORedis` (`maxRetriesPerRequest: null`, TLS when `VALKEY_TLS=true`); `connectDb()`, `disconnectDb()`; `sendMail({ to, subject, html, text }) => Promise<void>` (brevo | log → `storage/mail/<iso>-<to>-<slug>.json` with html+text).

- [ ] Tests: `parseEnv({})` throws an error whose message names `MONGO_URI` and `JWT_ACCESS_SECRET`; `parseEnv(minimalValid)` applies defaults (`PORT 5000`, `ORDER_EXPIRY_DAYS 3`, `MAIL_TRANSPORT 'log'`); `MAIL_TRANSPORT=brevo` without `BREVO_API_KEY` fails. In `NODE_ENV=test`, a `tests/setup.js` provides a valid env.

### Task 1.2: Errors, validation, responses

**Files:** `utils/AppError.js`, `utils/asyncHandler.js`, `utils/response.js`, `middlewares/validate.js`, `middlewares/error.middleware.js`; tests `tests/validate.test.js`, `tests/error.test.js`.

**Interfaces:** `new AppError(status, message, { code, errors })`; `sendSuccess(res, { data, message, meta, status = 200 })`; `validate({ body, params, query })` middleware; `errorHandler`, `notFound`.

- [ ] `validate`: replaces `req.body`/`req.params` with parsed (coerced, stripped) data; redefines `req.query` (Express 5 getter) — test with a mini app: `?limit=5` arrives as number `5`; unknown body key stripped; failure → 400 `VALIDATION_ERROR` with `errors: { 'items.0.quantity': '…' }` (path joined with `.`).
- [ ] Error handler: `AppError` → its status/code/errors; Mongo `11000` on `email` → 409 `CONFLICT`, `errors.email = 'Email is already taken'`; Mongoose `CastError` → 404 `NOT_FOUND`; unknown error → 500 `SERVER_ERROR` with no stack when `NODE_ENV=production`; unknown route → 404 `NOT_FOUND`; malformed JSON → 400 `VALIDATION_ERROR`.

### Task 1.3: Cursor pagination helper

**Files:** `utils/pagination.js`; test `tests/pagination.test.js` (mongodb-memory-server).

**Interfaces:** `cursorFilter({ sortField, direction, cursor }) => mongoFilter`, `cursorSort({ sortField, direction }) => { [sortField]: dir, _id: dir }`, `pageResult(docs, limit, sortField) => { items, meta: { nextCursor, hasMore } }`; cursor = base64url JSON `[sortValue, id]`. Repositories fetch `limit + 1`.

- [ ] Tests: 25 docs with only 3 distinct prices, paging by 7 asc and desc yields all 25 ids exactly once; bad cursor string → `AppError 400 VALIDATION_ERROR` on `cursor`; Date sort values round-trip.

### Task 1.4: Cookies, tokens

**Files:** `utils/cookies.js`, `utils/tokens.js`; test `tests/cookies.test.js`.

**Interfaces:** `cookieOptions({ maxAge? })`; `setAuthCookies(res, user, { remember })`; `clearAuthCookies(res)`; `signAccessToken(user)`, `signRefreshToken(user)` (payload `{ sub, tv }`), `verifyAccessToken`, `verifyRefreshToken`.

- [ ] Tests: prod → `secure:true, sameSite:'none'`; dev → `sameSite:'lax'`, `secure:false`; remember → refresh `maxAge` 30 days; no remember → no `maxAge`/`expires` (session cookie); access cookie maxAge 15 min.

### Task 1.5: Email queue, worker, templates

**Files:** `queues/email.jobs.js` (`EMAIL_JOBS = { TEST, VERIFY_EMAIL, RESET_PASSWORD, EMAIL_CHANGED_NOTICE, ORDER_PLACED, ORDER_STATUS_CHANGED, KALUPPA_NEW_ORDER }`), `queues/email.queue.js`, `queues/workers/email.worker.js`, `templates/email/layout.js`, `templates/email/test.template.js`, `utils/escapeHtml.js`; test `tests/email.test.js`.

**Interfaces:** `enqueueEmail(job, data)` (attempts 3, exponential backoff 5 s, removeOnComplete); `emailHandlers[job](data) => { to, subject, html, text }`; `processEmailJob({ name, data })`; `startEmailWorker()`, `closeEmailWorker()`, `closeEmailQueue()`; `renderLayout({ preheader, heading, bodyHtml, bodyText, cta? }) => { html, text }` (espresso header, crema body, roast CTA, Poppins→system fallback).

- [ ] Tests: `processEmailJob({ name:'TEST', data:{ to:'a@x.test', name:'<b>x</b>' } })` with log transport writes one file in `storage/mail/` containing `&lt;b&gt;x&lt;/b&gt;` and a text part; unknown job name throws. Manual check (after env is filled): `node -e` enqueue TEST → file appears.

### Task 1.6: Sockets, realtime, scheduler shell, cron, health, shutdown

**Files:** `sockets/index.js`, `sockets/realtime.js`, `schedulers/orderExpiry.scheduler.js`, `routes/cron.routes.js`, `routes/health.routes.js`, `routes/index.js`, `server.js`; tests `tests/cron.test.js`, `tests/health.test.js` (update).

**Interfaces:** `initSockets(httpServer) => io` (Valkey pub/sub adapter; handshake auth added in M5); `realtime.init(io)`, `realtime.toUser(id, event, payload)` (no-op before init); `runOrderExpiry() => { expired }` (acquires `lock:order-expiry` with `SET NX PX`; the expiry body is filled in Task 4.5), `startOrderExpiryScheduler()`, `stopOrderExpiryScheduler()`; `POST /api/cron/expire-orders` (header `x-cron-secret` = `CRON_SECRET`).

- [ ] Tests: cron without/with wrong secret → 401 `UNAUTHENTICATED`; correct → 200 `{ data: { expired: 0 } }` (`runOrderExpiry` mocked); health → 200 `{ status:'ok', checks:{ mongo:'up'|'down', valkey:'up'|'down' } }` and 503 when a check is down.
- [ ] `server.js` closes in the Global Constraints order on SIGTERM/SIGINT, each step in try/catch, hard exit after 10 s.

---

## M2 — Auth, roles & permissions

### Task 2.1: Models, permission matrix, seed commands

**Files:** `models/{user,role,permission,token}.model.js`, `constants/permissions.js`, `repositories/{user,role,token}.repository.js`, `database/commands/{migrateFresh,dbSeed}.js`, `database/seeders/{index,roles,users}.seeder.js`; tests `tests/seed.test.js`.

**Interfaces:** `PERMISSIONS` (slug → {name, group}), `ROLE_PERMISSIONS` (role slug → slugs, matrix of PRODUCT-SPEC §1), `ROLE_LABELS`; `runSeeders({ only?, fresh })`. User virtuals `fullName`, `initials`; password `select:false`, bcrypt 12 in a pre-save hook.

- [ ] Tests: `runSeeders` twice → same counts of roles/permissions/users (upsert by slug/email); `kaluppa@`, `manager@`, `farmer1@` (verified), `farmer2@` (unverified), `buyer@` (verified), `buyer.unverified@`, ~20 faker buyers; `migrateFresh` with `NODE_ENV=production` and no `--force` exits non-zero without dropping.

### Task 2.2: Permission resolution, guards, rate limiter

**Files:** `services/permission.service.js`, `middlewares/{auth,permission,verified,rateLimit}.middleware.js`; tests `tests/permissions.test.js`, `tests/rateLimit.test.js` (use `ioredis-mock` dev dependency for Valkey).

**Interfaces:** `resolvePermissions(user) => string[]` (roles ∪ direct, cached `perm:user:<id>` 600 s); `clearPermissionCache(userId)`; `clearAllPermissionCaches()` (seeder); `userCan(user, ...slugs)`; middleware `authenticate`, `optionalAuth`, `guestOnly`, `verified`, `role(...slugs)`, `can(...slugs)`, `canAny(...slugs)`; `rateLimit({ name, limit, windowSec, key: req => string })` → 429 `RATE_LIMITED` with `Retry-After`.

- [ ] Tests: kaluppa passes `can('anything.at_all')`; buyer `can('orders.manage')` → 403 `FORBIDDEN`; second resolve hits cache (repo spy called once); after `clearPermissionCache` a role change is seen; `verified`: unverified buyer → 403 `EMAIL_NOT_VERIFIED`, unverified farmer passes; suspended user → 403; `authenticate` with an access token whose user's `tokenVersion` changed is still accepted until expiry (access) but refresh is refused (Task 2.3).

### Task 2.3: Auth endpoints

**Files:** `schemas/{rules,auth}.schema.js`, `routes/auth.routes.js`, `controllers/auth.controller.js`, `services/auth.service.js`, `templates/email/{verifyEmail,resetPassword}.template.js`; tests `tests/auth.test.js`, `tests/rules.test.js`.

**Interfaces:** endpoints of PRODUCT-SPEC §4 Auth plus `POST /auth/refresh` (see questions). `/auth/me` → `{ user, roles, permissions }`. Tokens: random 32 bytes, stored as sha256 `tokenHash`; verify 24 h, reset 60 min; `usedAt` makes them single-use. Register body `{ firstName, middleName?, lastName, username, email, password, role: 'buyer'|'farmer' }`. Login `{ identifier, password, remember }`.

- [ ] Tests (`rules.test.js` table shared verbatim with frontend Task 2.4): passwords `Password123!` ok, `password1` (no symbol), `Pass!` (short), `!!!!1111` (no letter) rejected; usernames `juan.dc_1` ok, `Ju`, `UPPER`, `has space`, 31 chars rejected; phone `0917 555 0102` ok, `+639175550102` rejected.
- [ ] Tests (`auth.test.js`): register buyer → 201, sets cookies, enqueues `VERIFY_EMAIL` (queue mocked); duplicate email → 409 `errors.email`; login by username works; wrong password 401 generic message; 6th login in a minute → 429; verify token works once, second use → 400, expired → 400; reset password bumps `tokenVersion` and an old refresh token → 401; username-suggestions returns exactly 3 available names; forgot-password for an unknown email still 200 (no enumeration).

### Task 2.4: Frontend auth foundation

**Files:** `api/axios.js`, `stores/auth.store.js`, `services/auth.service.js`, `hooks/{useAuth,useCan,useRequireAuthAction}.js`, `components/auth/Can.jsx`, `schemas/{rules,auth}.schema.js`, `lib/{applyServerErrors,safeRedirect}.js`, `routes/{AppRouter,StorefrontRoute,GuestRoute,ProtectedRoute,RoleRedirect}.jsx`, `constants/roles.js`; tests `src/schemas/rules.test.js`, `src/lib/safeRedirect.test.js`, `src/api/axios.test.js`.

**Interfaces:** `safeRedirect(value, fallback) => string`; `applyServerErrors(error, setError) => boolean`; `useAuth()` → `{ user, roles, permissions, isLoading, isAuthenticated, isVerified }`; `useCan(slug) => boolean` (kaluppa always true); `useRequireAuthAction() => (fn) => void`; `<ProtectedRoute roles permissions requireVerified>`.

- [ ] Tests: rules table identical to Task 2.3; `safeRedirect('//evil.com')`, `'https://evil.com'`, `'/\\evil.com'`, `'javascript:alert(1)'` → fallback; `'/orders?x=1'` kept; axios: three parallel 401s → `/auth/refresh` called once and all three retried; refresh failing → auth store cleared once; `EMAIL_NOT_VERIFIED` → navigates to `/verify-email`.

### Task 2.5: Auth pages, dashboard placeholder, 403/404

**Files:** `components/ui/{Button,Input,Label,FieldHint,Select,Textarea,PasswordInput,PasswordRule,RadioCard,Eyebrow,Modal,ConfirmDialog,Spinner}.jsx`, `layouts/{AuthLayout,DashboardLayout}.jsx`, `pages/auth/{Login,Register,ForgotPassword,ResetPassword,VerifyEmail,VerifyEmailConfirm}.jsx`, `pages/dashboard/Overview.jsx`, `pages/errors/{Forbidden,NotFound}.jsx`.

- [ ] Each page copied from its `.dc.html` (DESIGN §3 "Copying the design exactly"); Register: role cards, live username availability (debounced), 3 suggestion chips, password rule; VerifyEmail: resend with 60 s cooldown, helper text exactly "Adding to cart, checking out and reviewing need a verified email."; logout via `ConfirmDialog` (Modals.dc.html logout variant); Dashboard: role label, greeting by Manila time of day, unverified banner with Resend.
- [ ] Component test: `ConfirmDialog` traps focus and closes on Esc (vitest + `@testing-library/react`, jsdom — see questions).

### Task 2.6: Playwright auth flows

**Files:** `frontend/playwright.config.js` (webServer: both apps, `MAIL_TRANSPORT=log`), `e2e/helpers/mailbox.js` (`latestMailLink(to, pathPrefix)`), `e2e/auth.spec.js`.

- [ ] Buyer signup → `/verify-email` → open link from mailbox → lands on `/`; farmer signup → `/dashboard/overview`; forgot → reset → login with new password; guard: logged-in farmer visiting `/` → `/dashboard/overview`.

---

## M3 — Catalog, posts & seeders

### Task 3.1: Catalog models and endpoints

**Files:** `models/{category,product,review,order,counter}.model.js` (Order/Counter schema only — needed for review eligibility and demo seeding), `repositories/{category,product,review}.repository.js`, `services/{catalog,review}.service.js`, routes/controllers/schemas for catalog + reviews; tests `tests/catalog.test.js`, `tests/reviews.test.js`.

**Interfaces:** `listVisibleCategories(viewer)`; `listProducts(viewer, { search, category, variety[], coffeeType[], minPrice, maxPrice, featured, sort: 'newest'|'price_asc'|'price_desc'|'rating'|'popular', cursor, limit≤24 })`; `getProductBySlug(viewer, slug)`; `isPurchasable(viewer, category)`; reviews `listReviews(productId, cursor)`, `getSummary(productId) => { average, count, distribution: {1..5} }`, `getMyReview`, `createReview(user, productId, {rating, comment})`, `updateReview(user, id, …)`, `recomputeRating(productId)`.

- [ ] Tests: guest sees Coffee only; farmer sees Coffee + Fertilizer + Seedlings; hidden-category product slug → 404 for guest; inactive product → 404; `price_asc` and `rating` paging stable across ties (no dup/missing); review without a sold order → 403; second review → 409; create/update recompute `ratingAverage` (1 dp) and `ratingCount`; unverified buyer → 403 `EMAIL_NOT_VERIFIED`.

### Task 3.2: Settings, delivery info, locations

**Files:** `models/setting.model.js`, `repositories/setting.repository.js`, `services/setting.service.js`, `data/marinduque-locations.json` (copied), `data/postal-codes.js`, routes for `/settings/landing`, `/settings/payment`, `/delivery/info`, `/locations`; test `tests/settings.test.js`.

**Interfaces:** `getSetting(key)`; `getLocations() => [{ name, postalCode, barangays: string[] }]`; `isValidBarangay(municipality, barangay)`.

- [ ] Tests: `/locations` → 6 municipalities, 218 barangays, Boac 4900…Gasan 4905; `/settings/payment` needs a verified login; `/delivery/info` public and exposes fee rules + ETA days + pickup, not `origin` secrets beyond the pickup pin.

### Task 3.3: Posts (read-only)

**Files:** `models/{post,postComment,reaction}.model.js`, repository/service/routes/controller for posts; test `tests/posts.test.js`.

- [ ] Tests: `/posts/latest?limit=3` newest published, not deleted; `/posts/:id/comments?limit=5` returns top-level comments each with ≤2 replies and `replyCount`; `/comments/:id/replies` pages by cursor; no write endpoints exist for posts in Phase 1.

### Task 3.4: Seeders and media

**Files:** `database/seeders/{categories,products,settings,posts,media,demo}.seeder.js`, `database/seeders/data/{products.js,media.json}`; extend `tests/seed.test.js`.

**Interfaces:** `verifyMediaUrl(url) => { ok, contentType }` (GET, 200 + `image/*`|`video/*`); `uploadSeedMedia(key, url)` → Cloudinary `seed/<key>` `overwrite:false`, falls back to the remote URL on failure.

- [ ] Products per PRODUCT-SPEC §11 (4 varieties × green kg / roasted 250 g pack / ground 250 g pack, low-stock, one out of stock, 4–6 featured; hidden fertilizer ~5, seedlings 1 per variety). Settings with §2 values. 3 hero slides. ~8 posts with comments/replies/reactions. Demo: extra buyers get sold orders + reviews (review text never mentions messaging or chat); ≥2 products with ≥12 reviews.
- [ ] Tests: `db:seed` twice → no duplicate categories/products/settings/posts; demo skipped on the second plain run; `--only=settings` touches settings only.

### Task 3.5: Storefront UI

**Files:** `layouts/StorefrontLayout.jsx`, `components/layout/{Navbar,Footer,AvatarMenu,MobileMenu}.jsx`, `components/ui/{SectionHeading,ChipToggle,StarRating,QuantityStepper,EmptyState,Skeleton}.jsx`, `components/product/{ProductCard,HeroCarousel,ReviewList,ReviewForm}.jsx`, `components/post/{MediaViewer,ReactionSummary,CommentThread}.jsx`, `pages/storefront/{Landing,Products,ProductDetail,PostDetail}.jsx`, hooks/services for products, categories, reviews, posts, settings; tests for `lib/quantity.js` (`stepFor(unit)`, `clampQuantity`).

- [ ] Copy Main, Products, ProductDetail, PostDetail, Navbar, Footer screens. `SectionHeading` = text-only `Eyebrow` + H2 + lead (no bar — Change 02). Landing "What KapeKonek does" third card: bell icon, tag "Updates", title "Know where your order is", text "Email and in-app notifications at every step, from confirmation to delivery." Products filters synced to the URL; `useInfiniteQuery` + IntersectionObserver; "Loading more coffee…". Add/Cart/Write review go through `useRequireAuthAction`.

### Task 3.6: Playwright storefront

- [ ] Landing, products (filter + scroll loads more), product detail, post detail vs screens at 1440/390; guest clicks Add → `/login?redirect=/products/<slug>` → after login returns there.

---

## M4 — Addresses, delivery quotes, cart, checkout, orders

### Task 4.1: Geo, delivery quote, business days

**Files:** `clients/mapbox.client.js`, `services/{deliveryQuote,geo}.service.js`, `utils/{businessDays,manilaDate}.js`, routes `/geo/*`, `/delivery/quote`; tests `tests/deliveryQuote.test.js`, `tests/businessDays.test.js`.

**Interfaces:** mapbox client `drivingDistanceKm(from, to)`, `reverseGeocode(lat, lng)`, `forwardGeocode(query)`; `computeFee(distanceKm, rules) => feeCentavos`; `quoteForPoint({ lat, lng }) => { distanceKm, feeCentavos, distanceSource, eta }`; `quoteForAddress(address)`; `addBusinessDays(date, n)` in Manila; `etaWindow(from = now)`.

- [x] Tests: fee 2 km → 5000; 3 km → 5000; 7.2 km → 5000 + 4.2×1000 = 9200 → rounded up to 9500; > `maxKm` → 422 `OUTSIDE_DELIVERY_AREA`; point outside bounds → 422 `OUTSIDE_DELIVERY_AREA`; Mapbox throws → `distanceSource:'fallback'` with haversine × 1.35; second quote for same 4dp point served from cache (client called once); address without pin and forward geocode fails → 422 `ADDRESS_NEEDS_PIN`; ETA from Fri → Wed–Fri next week; from `2026-11-23T17:00Z` (Tue Manila) counts from Tuesday.

### Task 4.2: Addresses

**Files:** `models/address.model.js`, repository/service/schema/routes/controller; test `tests/addresses.test.js`.

**Interfaces:** `listAddresses(user)` (each with `pinned` and, if quotable, `quote`), `createAddress`, `updateAddress`, `deleteAddress` (soft), `setDefault`.

- [x] Tests: first address becomes default; 11th → 409 `CONFLICT` "You can save up to 10 addresses"; deleting the default promotes the newest remaining; another user's address → 404; barangay not in municipality → 400 `errors.barangay`; location outside 13.15–13.62 / 121.80–122.20 → 400; postal code derived, client value ignored.

### Task 4.3: Cart and uploads

**Files:** `models/cart.model.js`, cart repository/service/schema/routes/controller, `services/upload.service.js` + `/uploads/signature`; tests `tests/cart.test.js`, `tests/uploads.test.js`.

**Interfaces:** `getCart(user) => { lines: [{ product, quantity, lineTotalCentavos, flags: ('OUT_OF_STOCK'|'OVER_STOCK'|'INACTIVE'|'NOT_PURCHASABLE')[] }], subtotalCentavos, canCheckout }`; `addItem`, `setQuantity`, `removeItem`, `clearCart`; `createUploadSignature(user, type)` → folder `${CLOUDINARY_ROOT_FOLDER}/receipts/<userId>` or `/avatars/<userId>`.

- [x] Tests: 0.75 kg → 400; 1.5 pack → 400; farmer adding Coffee → 403 (no `catalog.coffee`); quantity above stock → line flagged `OVER_STOCK`, `canCheckout:false`; unverified buyer → 403 `EMAIL_NOT_VERIFIED`.

### Task 4.4: Order placement

**Files:** `models/notification.model.js` (schema; endpoints in M5), `repositories/{order,counter,notification}.repository.js`, `services/{order,notification}.service.js`, `templates/email/{orderPlaced,kaluppaNewOrder}.template.js`, order schema/routes/controller; test `tests/orderPlace.test.js`.

**Interfaces:** `nextOrderNumber(date) => 'KK-YYYYMMDD-NNNN'` (Counter `_id: order:YYYYMMDD` Manila); `placeOrder(user, body) => order`; `listMyOrders(user, { status, cursor })`; `countMyOrders(user) => { [status]: n }`; `getOrderFor(user, id)`.

- [x] Tests: each of the 4 combinations succeeds with its required fields and fails without (delivery without address → 400; e-wallet without receipt → 400; receipt `publicId` outside `kapekonek/receipts/` → 400; cash with receipt → 400; pickup without phone and no profile phone → 400 `errors.contactPhone`; pickup phone saved to profile); client `deliveryFeeCentavos` ignored; two concurrent placements → one 201 + one 409; stale cart (price changed → order uses new price; inactive → 409 listing it); order number Manila date; cart cleared, `ORDER_PLACED` + `KALUPPA_NEW_ORDER` enqueued, buyer + Kaluppa notifications created.

### Task 4.5: Status machine, cancel, refund, expiry

**Files:** `services/orderStatus.service.js` (transition table), `constants/orderStatus.js`, `templates/email/orderStatusChanged.template.js`, staff routes; fill `runOrderExpiry`; tests `tests/orderStatus.test.js`, `tests/orderExpiry.test.js`.

**Interfaces:** `TRANSITIONS` table `{ from, to, who: 'buyer'|'staff'|'system', methods?: ['delivery'|'pickup'], requiresReason?, effects[] }`; `transition(actor, orderId, { status, reasonCode, reason, note, rider })`; `cancelByBuyer(user, id, { reasonCode, reason })`; `markRefunded(actor, id, { referenceNumber })`; `expirePendingOrders(now) => count`.

- [x] Tests: every allowed transition in PRODUCT-SPEC §3 succeeds; every other pair → 409; `out_for_delivery` on pickup and `ready_for_pickup` on delivery → 409; buyer cancel only from pending and only own; reserved with insufficient stock for item 2 → 409 listing it and item 1's stock restored; two parallel reserves on the last unit → one succeeds; cancel/reject after reserved returns stock; `sold` sets `cashCollectedAt` for cash and adds `soldCount`; e-wallet cancelled/rejected/expired → `refund.status:'pending'`, cash stays `not_applicable`; refund needs pending refund; expiry only touches pending older than 3 days; expiry racing a reserve leaves the order reserved; lock held → second run returns `{ expired: 0 }`.

### Task 4.6: Order/address seeders

- [x] `buyer@` gets the three addresses of §11 and ~15 orders over all 9 statuses (delivery/pickup, e-wallet/cash, rider notes, ETAs, one refunded + pending refunds); extra buyers one address each. Fees via `computeFee` with fallback distance when no Mapbox token.

### Task 4.7: Cart, address, checkout, order UI

**Files:** `components/order/{CartDrawer,StatusPill,RefundBadge,StatusTimeline,EtaLine,OrderCard,OrderGroupTabs,StatusChips,CancelOrderDialog}.jsx`, `components/map/{MapPicker,AddressFormModal,AddressCard}.jsx`, `components/order/{DeliveryMethodCards,PaymentCards,ReceiptUpload}.jsx`, `pages/account/{Addresses,Checkout,Orders,OrderDetail}.jsx`, `constants/orderStatus.js`, hooks/services for cart, addresses, locations, geo, delivery, orders, uploads, settings; test `src/constants/orderGroups.test.js` (group → statuses mapping).

- [x] Copy CartDrawer, Addresses, AddressModal, Checkout, Orders, OrderDetail, Modals. OrderDetail is full width with no right column: status banner (rider name/phone when out for delivery), Items + totals, address/pickup and payment cards side by side (`repeat(auto-fit, minmax(260px, 1fr))`, gap 20px), then "Status history"; check at 1440 and 390 px. Map via `react-map-gl/mapbox`; geocoding only through `/geo/*`. Every confirmation modal in Global Constraints.

### Task 4.8: Playwright orders

- [x] Delivery: verified buyer adds an address by dropping a pin → checkout → delivery + cash on delivery → pending → cancel with reason → no refund badge. Pickup: second order → pickup + GCash with a receipt → pending. Guard: unverified buyer on `/checkout` → `/verify-email`.

---

## M5 — Notifications & live order updates

No order chat (Change 01). Socket.IO carries only `notification:new` and `order:updated`.

### Task 5.1: Socket auth and user rooms

**Files:** `sockets/index.js` (handshake reads the `accessToken` cookie; each socket joins `user:<id>`; no other rooms or client events), test `tests/sockets.test.js`.

- [ ] Tests: handshake without a valid cookie is refused; `realtime.toUser(id, 'order:updated', …)` reaches only that user's sockets; the server registers no `conversation:*` / `message:*` handlers.

### Task 5.2: Notifications and status emails

- [ ] Notification endpoints (cursor list, unread count, read one, read all); `type` is `order_status|order_new|system` (`order_new` = Kaluppa's new-order notification); create notifications for every §7 event (buyer: every status change, refund marked; Kaluppa: new order) and emit `notification:new`; every status change emits `order:updated`; `ORDER_STATUS_CHANGED` email for every status with rider / pickup / reason + refund note; demo notification seeder. Tests: unread count after events; read-all; other user's notification → 404; `/auth/me` permissions contain no `chat.*`; `GET /api/conversations/x/messages` → 404.

### Task 5.3: Frontend realtime

- [ ] `lib/socket.js` + `hooks/useRealtime.js` listening only to `notification:new` and `order:updated`, invalidating the notification and order queries; navbar bell dropdown (unread count, mark all read, load more). Playwright: buyer on `/orders/:id` while Kaluppa moves the order to *out for delivery* via the API → the bell count and the status banner (with rider) update live without reload.

---

## M6 — Profile & settings

### Task 6.1: Account endpoints

- [ ] `GET/PATCH /account/profile`, `PATCH/DELETE /account/avatar` (Cloudinary destroy old), `PATCH /account/email` (current password; unverifies, queues `VERIFY_EMAIL` to new + `EMAIL_CHANGED_NOTICE` to old), `PATCH /account/password` (current password; `tokenVersion++`; re-issue this session's cookies). Tests: username taken → 409; email change flow; other sessions' refresh fails after password change.

### Task 6.2: Profile and Settings pages

- [ ] Copy Profile.dc.html and Settings.dc.html; avatar via signed upload. Playwright both flows.

---

## M7 — Polish & verification

- [ ] Screenshot every page at 1440/390 vs screens; fix.
- [ ] Accessibility pass (labels, focus order, keyboard dropdown/drawer/modals, contrast).
- [ ] `/impeccable` polish + audit within the screens; taste review.
- [ ] Route-level `lazy()`, Cloudinary `f_auto,q_auto,w_…`, lazy images, query `staleTime` 30 s default.
- [ ] `README.md` (setup, env, commands, seed accounts, deploy notes).
- [ ] PHASE-1-PROMPT §4 checklist all green.

---

## Milestone summaries

### M0 — done (2026-11-21)

- Git repo on branch `phase-1`; root `package.json` (`dev`, `setup`, `lint`, `test`, `test:e2e`) with `concurrently`; `.gitignore`; `.gitattributes` (LF).
- `backend/`: Express 5 + all M0 packages (latest: express 5.3, mongoose 9, zod 4, bullmq 6, ioredis 6, vitest 5); folder tree; `src/app.js` with helmet, CORS, JSON limit and `GET /api/health`; `src/server.js` on `PORT || 5000`; eslint flat config; `tests/health.test.js`.
- `frontend/`: Vite 8 + React 19 (create-vite, ESLint variant); all M0 packages plus `vitest`; Tailwind v4 via `@tailwindcss/vite`, DESIGN §2 tokens in `src/index.css`; Poppins 400–700 via `@fontsource`; `@` alias; `vercel.json`; bean favicon; `formatPeso()` + test; Playwright Chromium installed.
- `.env.example` in both apps with every PRODUCT-SPEC §12 variable.
- Verified: `npm run dev` starts both; `/api/health` → `{"success":true,"data":{"status":"ok"}}`; page font is Poppins (all 4 weights load) and `--color-roast` = `#7B4A2A`; root lint + tests green.
- Not run for M0: `migrate:fresh` (commands land in M2), graphify (nothing to graph yet), screen comparison (blank page only).

### M1 — done (2026-11-21)

- **Config**: `env.js` validates every variable with Zod at boot (blank = missing; lists every bad key); `db.js`; `valkey.js` factory `createValkeyConnection(name)` + shared `getValkey()` + `closeValkeyConnections()`; `cloudinary.js`; `mail.js` `sendMail()` with `brevo` / `log` (`storage/mail/*.json`).
- **HTTP core**: `AppError` (code derived from status), `asyncHandler`, `sendSuccess`, shared `validate({ body, params, query })` (flat `errors` map, Express 5 `req.query` redefined), error middleware (AppError, Mongo 11000 → 409 with field, CastError → 404, bad JSON → 400, unknown → 500 without internals), 404 middleware; helmet, CORS (`CLIENT_URL`, credentials), 100 kb JSON limit, cookie-parser, morgan, `trust proxy`.
- **Utils**: cursor pagination (`cursorFilter`, `cursorSort`, `pageResult`, `encodeCursor`/`decodeCursor`), `cookieOptions()` / `setAuthCookies` / `clearAuthCookies`, access/refresh tokens with `tv` (tokenVersion) and `rem`, `escapeHtml`, `withLock` (SET NX PX + compare-and-delete).
- **Email**: BullMQ queue `email` (3 attempts, exponential backoff), worker with a handler map running inside the API, coffee HTML + text layout, `TEST` job.
- **Realtime / jobs**: Socket.IO with the Valkey adapter and `realtime.toUser`; order-expiry scheduler (shell: the sweep is a no-op until Task 4.5) behind `lock:order-expiry`; `POST /api/cron/expire-orders` (`x-cron-secret`, constant-time); `GET /api/health` → Mongo + Valkey checks, 503 when degraded; graceful shutdown HTTP → Socket.IO → scheduler → worker → queue → Valkey → Mongo (10 s hard stop).
- **Tests**: 44 backend tests (env, validate, errors, pagination on tied sorts, cookies/tokens, email queue + worker + escaping, lock + scheduler, cron, health). `tests/globalSetup.js` downloads mongod before tests (a first run from the repo root used to time out while downloading it).
- **Verified against the real services**: Atlas Mongo + Aiven Valkey → `/api/health` `ok`; a queued `TEST` email went through Valkey and the worker into `storage/mail/`; SIGTERM shuts down cleanly (exit 0).
- **Blocker for the user**: `backend/.env` has `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `CRON_SECRET` shorter than the minimums, so `npm run dev` refuses to start until they are regenerated. (The checks above ran with temporary secrets.)
- Not run: Playwright (no pages changed), `migrate:fresh` (commands arrive in M2).

### M2 — done (2026-11-21)

- **Data**: `User` (bcrypt 12 pre-save, `password` select:false, virtuals `fullName`/`initials`, `tokenVersion`, `status`), `Role`, `Permission`, `Token` (sha256 `tokenHash`, TTL on `expiresAt`, single-use `usedAt`). Matrix in `constants/permissions.js` (17 permissions, 4 roles); repositories `user`, `role`, `token`.
- **Seeding**: `npm run migrate:fresh [-- --seed]` (refuses production without `--force`, drops, syncs every index) and `npm run db:seed [-- --only=roles,users]`; ordered registry in `database/seeders/index.js`. Seeds 6 named accounts + 20 fixed-seed faker buyers, idempotent upserts. Ran on Atlas: 4 roles, 17 permissions, 26 users.
- **Guards**: `authenticate` / `optionalAuth` / `guestOnly`, `verified` (unverified buyer → 403 `EMAIL_NOT_VERIFIED`), `role`, `can`, `canAny` (kaluppa passes all); permissions cached in `perm:user:<id>` for 600 s, falling back to Mongo if Valkey fails; fixed-window `rateLimit` in Valkey (429 + `Retry-After`, fails open).
- **Auth API**: register, login (email or username, generic 401, dummy-hash timing, 5/min per IP+identifier), refresh, logout, me, username availability + 3 suggestions, verify email + resend (1/min), forgot (no enumeration) + reset (bumps `tokenVersion`, signs out other sessions). `VERIFY_EMAIL` / `RESET_PASSWORD` email jobs and templates.
- **Frontend foundation**: axios with single-flight refresh on 401 and the `EMAIL_NOT_VERIFIED` redirect; Zustand session store; TanStack hooks; `useCan`, `<Can>`, `useRequireAuthAction`; `safeRedirect`; `applyServerErrors`; shared `schemas/rules.js` (identical file + identical test table on both sides).
- **UI**: `Button`, `Input`/`Label`/`FieldHint`, `PasswordInput`/`PasswordRule`, `RadioCard`, `Eyebrow`, `Alert`, `Modal` (focus trap, Esc, focus return), `ConfirmDialog`, `Spinner`; `AuthLayout`, `DashboardLayout`; pages Login, Register (live availability, 3 suggestion chips, password rule), Forgot/Reset password (expired-link state), Verify email (60 s resend cooldown), verify-link confirm, Dashboard overview (role sidebar, Manila-time greeting, unverified banner), 403, 404; logout confirmation. `/` is a placeholder until M3.
- **Tests**: backend 89 (rules table, seeding, guards + cache, rate limit, 20 auth flows); frontend 29 (rules table, safeRedirect, axios refresh/expiry/verify, ConfirmDialog focus trap + Esc); Playwright 8 (buyer signup → mailbox link → `/`, farmer signup → dashboard, forgot → reset → login + reused link, farmer on `/` → dashboard, guest → login → back, buyer → 403 + `//evil.com` ignored, logout confirm + Esc, wrong password).
- **Visual check** (1440 and 390 px against the `.dc.html` files): Login, Register, Forgot, Reset, Verify, Dashboard, logout modal match. Fixed a 66 px horizontal overflow on mobile Register and a 7 px checkbox offset on Login.
- **Fixed along the way**: nodemon watched `storage/mail/`, so every logged email restarted the dev API; it now watches only `src/` and `.env`. Playwright now runs its own API (5100) and web server (5174).
- Not done here: brand-panel photos (seeded media arrives in M3), `Select`/`Textarea` (added with the first form that needs them).

### Change 02 — done (2026-11-22)

Source: `docs/prompts/CHANGE-02-NO-EYEBROW-BAR-NO-CHAT.md`, applied after M2 and before M3, with the user's updated `CLAUDE.md`, `docs/` and screens.

- **Eyebrow bar removed**: `components/ui/Eyebrow.jsx` is text only (same size, weight, tracking, colors). No page drew the bar inline, so every built page (auth panel and forms, Verify email + link confirm, Dashboard overview, 403/404, the `/` placeholder) changed through the component. Checked at 1440 and 390 px against the updated screens.
- **No order chat**: re-checked after Change 01. No chat code, sockets, routes, seeds or tests exist; `chat.use`/`chat.moderate` were never part of the matrix (17 permissions). Re-seeded roles and cleared `perm:user:*`. The replaced `canvas.json` had the Order detail title back as "… + chat with Kaluppa"; reverted to "Order detail — delivery, COD".
- **Plan**: M5 and the full-width Order detail already matched; aligned the Notification `type` with the new spec (`order_status|order_new|system`) and noted the text-only eyebrow in Global Constraints and Task 3 (`SectionHeading`).

### M3 — done (2026-11-22)

- **Catalog API**: `Category`, `Product`, `Review`, `Order`, `Counter`, `Setting`, `Post`, `PostComment`, `Reaction` models and one repository each. Routes: `GET /categories`, `/products` (search, variety, coffeeType, price in pesos, featured, sort newest/price/rating/popular, cursor + `meta.total`), `/products/:slug`, reviews (list, summary, `me`, create with a completed order, edit own), `/locations`, `/delivery/info`, `/settings/landing`, `/settings/payment` (verified), `/posts/latest`, `/posts/:id`, comments (oldest first, 2 reply previews + cursor), replies. Category visibility follows `isPublic` or the category's purchase permission.
- **Seeders** (`roles → users → categories → products → settings → posts → demo`): 3 categories; 12 coffee products (1 out of stock, 1 low, 5 featured) plus hidden fertilizer (5) and seedlings (4); every setting with 3 hero slides; 8 posts (text-only, multi-image, video) with 13 comments and 27 reactions; 21 sold demo orders (`KK-YYYYMMDD-NNNN`, Manila date) and 50 reviews (Barako 16, Robusta 14), `soldCount` and ratings recomputed. Media: 25 Pexels photos + 1 video in `seeders/data/media.json`, each URL checked (200 + image/video) and uploaded once to Cloudinary as `seed/<key>` (remote URL kept if the upload fails). Posts and demo skip when data exists. `migrate:fresh --seed` ran on Atlas.
- **Utils for M4**: `feeForDistance`, `haversineKm`, `manilaDateKey`, `nextOrderNumber` (tested).
- **Storefront UI**: `StorefrontLayout`, `Navbar` (guest/buyer, keyboard account menu, mobile menu), `Footer`; Landing (hero carousel from settings with autoplay that pauses on hover/focus and respects reduced motion, featured, varieties, how it works, latest posts, farmer band, features, one-open FAQ, CTA); Products (URL-synced filters and sort, infinite scroll, skeleton/empty/error); Product detail (gallery, unit-aware quantity stepper, review summary, list and form); Post detail (media viewer, reaction summary, read-only comment thread). The auth brand panel now shows the first hero photo.
- **Tests**: backend 135 (catalog, reviews, settings, posts, seeders incl. idempotency and `--only=settings`, delivery fee, Manila date); frontend 41 (adds `quantity`, `timeAgo`); Playwright 13 (auth 8 + storefront 5: landing/FAQ/post, products filter + scroll + reload, guest Add → login → back, buyer review, mobile menu + keyboard account menu).
- **Visual check** at 1440 and 390 px against Main, Products, ProductDetail, PostDetail, Navbar, Footer: matches; fixed portrait post covers stretching their cards, a clipped 4th line in post previews, and the 390 px header overflowing.
- **Shortcuts until M4/M5**: Add / Add to cart / cart button show a "cart opens in the next update" toast for signed-in buyers (`useAddToCart`); the notifications bell has no count; Terms/Privacy links point home.

### M4 — done (2026-11-22)

- **Geo & delivery**: Mapbox client (Directions v5, Geocoding v6 forward/reverse, 6 s timeout); `/geo/reverse`, `/geo/search` (30/min per user), `/delivery/quote` (address or point). Quotes use road distance rounded to 0.1 km, cached in Valkey 24 h (the straight-line fallback is never cached); outside the Marinduque bounds or past `maxKm` → 422 `OUTSIDE_DELIVERY_AREA`; an unpinned address that can't be geocoded → 422 `ADDRESS_NEEDS_PIN`. ETA = 3–5 Manila business days.
- **Addresses**: up to 10, one default (first is default; deleting the default promotes the newest), optional GeoJSON pin, list carries each address's `quote` or `quoteError`.
- **Cart & uploads**: per-line flags (`INACTIVE`, `OUT_OF_STOCK`, `OVER_STOCK`, `NOT_PURCHASABLE`) and `canCheckout`; signed Cloudinary uploads (`avatar`, `receipt` under `receipts/<userId>`).
- **Orders**: placement under a 30 s per-buyer lock, fee always recomputed, receipt must be the buyer's own upload, pickup phone saved to the profile; status machine (reserve deducts stock atomically with rollback, rider details, cash collected, refunds pending/refunded), buyer cancel with reason, expiry sweep; emails `ORDER_PLACED`, `KALUPPA_NEW_ORDER`, `ORDER_STATUS_CHANGED` through BullMQ; in-app notifications; `order:updated` emitted.
- **Seeders**: `addresses` (Juana's Home/Work/Mama's house, one pinned address per extra buyer); Juana gets 15 orders across all 9 statuses (delivery/pickup × e-wallet/cash, rider, ETAs, one refunded with ref 7023118842, pending refunds) with notifications; reserved stock and sales applied. `migrate:fresh --seed` ran on Atlas.
- **UI**: `AccountLayout`; cart drawer (steppers, stock warnings, disabled Checkout, remove/clear/checkout confirmations) with the navbar count; Checkout (method, address radio cards with distance and fee, pickup card + phone, GCash/Maya QR tabs with SAMPLE stamp, receipt upload with progress, cash note, note, live summary, place-order confirmation); Addresses + address modal (Mapbox map lazy-loaded, search, use my location, draggable pin → `/geo/reverse` fills the fields, outside-area error, fee preview); Orders (6 group cards, status chips, URL filters, infinite scroll); Order detail (status banner with rider/ETA, items + totals, address/pickup and payment cards, status timeline, cancel with reason). `Modal` gained a right-drawer placement and only the top dialog handles Esc/Tab.
- **Tests**: backend 210; frontend 63 (adds order groups + timeline, quantity/phone formatting); Playwright 16 (adds delivery + COD + cancel with a map-pinned address, pickup + GCash receipt upload, unverified buyer → `/verify-email`). The mailbox helper now skips half-written mail files.
- **Visual check** at 1440 and 390 px against CartDrawer, Checkout, Addresses, AddressModal, Orders, OrderDetail, Modals: matches; fixed Juana's Home pin sitting in the bay, the map hint overlapping the Mapbox logo, a broken total divider, and the place search squeezing at 390 px.
- **Still to come (M5)**: live updates on `order:updated` in the UI, the notification bell count and list.
