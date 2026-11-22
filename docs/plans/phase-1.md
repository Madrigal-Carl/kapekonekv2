# KapeKonek Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status (2026-11-23):** rewritten from the current docs on request. The code already exists on `phase-1` (M0–M7 and Changes 01–04 shipped; history and logs are in `docs/plans/phase-1.archive.md`). This plan folds Changes 01–04 into the baseline. Running it against the existing code means **check and align each milestone** (run its tests, compare with its screens, fix gaps), not scaffold again. Milestone 0 waits for the user's OK.

**Goal:** Everything a guest and a buyer use in KapeKonek: storefront, auth, addresses with a Mapbox pin, cart, checkout (delivery/pickup × e-wallet/cash), orders with the full status machine, notifications with live order updates, profile and settings. Plus the backend those flows need, matching the approved `.dc.html` screens.

**Architecture:** One Express 5 process (`backend/`) serves the API and also runs the BullMQ email worker, Socket.IO (Valkey adapter) and the order-expiry scheduler; requests flow route → auth guards → `validate()` → controller → service → repository → model. `frontend/` is a React 19 + Vite SPA; data flows Zod form → TanStack Query hook → service → axios.

**Tech Stack:** Node ≥22, Express 5, Mongoose, Zod, BullMQ + ioredis 5 (Valkey), Socket.IO, Cloudinary, Brevo, Mapbox (server: Directions + Geocoding; client: `react-map-gl` + `mapbox-gl`), Vitest + Supertest + mongodb-memory-server + ioredis-mock; React 19, Vite, Tailwind v4 (`@tailwindcss/vite`), TanStack Query, Zustand, react-hook-form, Testing Library, Playwright.

**Spec:** `CLAUDE.md`, `docs/PRODUCT-SPEC.md`, `docs/DESIGN.md` §1–7, `docs/prompts/PHASE-1-PROMPT.md`, `docs/design/screens/*.dc.html` (Phase 1 screens in DESIGN §5). Gaps and the choices made: `docs/plans/phase-1-questions.md` (items 1–26 apply).

## Global Constraints

- JavaScript ES modules both sides, no TypeScript; JSDoc on public service and repository functions.
- Backend flow: `route → authenticate/optionalAuth → verified → can()/role() → validate() → controller → service → repository → model`. Only repositories import models. Outside APIs only in `src/clients/`, called only by services. Sockets only through `realtime.toUser`, only `notification:new` and `order:updated`. **No order chat** anywhere (UI, API, sockets, data).
- Response `{ success, message?, data, meta? }` / `{ success:false, message, code, errors, data? }`; `errors` is a flat `field → message` map. Codes: `VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, EMAIL_NOT_VERIFIED, NOT_FOUND, CONFLICT, RATE_LIMITED, SERVER_ERROR`; domain codes `ADDRESS_NEEDS_PIN`, `OUTSIDE_DELIVERY_AREA`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` (422), `QUANTITY_EXCEEDS_STOCK`, `ALREADY_REVIEWED` (409), `REVIEW_NOT_ALLOWED` (403).
- Money = integer centavos; line total `Math.round(priceCentavos * quantity)`; format only in the frontend with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
- Quantity: `kg` step 0.5 (min 0.5), `pack`/`piece` integers (min 1), compared in integer steps (`Math.round(q * 2)` for kg). Same Zod rule both sides. Cart add **adds to** the line; result ≤ stock or `409 QUANTITY_EXCEEDS_STOCK {stock, inCart, maxAddable}`; never clamp on the server.
- Cursor pagination everywhere (`?cursor=&limit=` → `meta.nextCursor`, `meta.hasMore`) through one helper encoding `(sortValue, _id)`.
- Password ≥8 with a letter, a digit and a symbol. Username `^[a-z0-9._]{3,30}$`. Names 1–50. Phone `^09\d{9}$` after removing spaces. Address: recipient 2–80, street 5–200, customLabel ≤30, lat 13.15–13.62, lng 121.80–122.20. Review comment 10–1000, rating 1–5. Cancel "other" 5–300. Rider name 2–60.
- `UPLOAD_RULES`: `image` jpg/png/webp/heic ≤ 5 MB (avatar, receipt); `file` pdf/mp4/webm ≤ 10 MB. Checked in the browser, re-checked on the server from Cloudinary's stored `bytes`/`format`. Copy: "<name> is 7.2 MB. Images can be up to 5 MB." / "Files can be up to 10 MB."
- Cookies via one `cookieOptions()`: `accessToken` 15 min; `refreshToken` 30 days with "Remember me", else a session cookie; httpOnly; prod `secure:true, sameSite:'none'`, dev `sameSite:'lax'`. Tokens carry `tokenVersion`, checked on access and refresh.
- Permission cache `perm:user:<id>` TTL 600 s; `kaluppa` passes every `can()`. Features check permissions, never `role === 'buyer'`; purchasability = category `purchasePermission`.
- Buyers must verify for every authenticated buyer action (`403 EMAIL_NOT_VERIFIED`). In Phase 1, unverified farmers, Group Managers and Kaluppa may reach the placeholder dashboard (question 26).
- Every email goes through BullMQ (3 attempts, exponential backoff); user text escaped. `MAIL_TRANSPORT=log` writes to `backend/storage/mail/`. Without `SEED_EMAIL_BASE`, mail to `isSeed` users is logged with `note: "skipped-seed"`, never sent.
- Shutdown order: HTTP → Socket.IO → scheduler → worker → queue → Valkey → Mongo.
- Mapbox Directions/Geocoding only on the backend (`MAPBOX_ACCESS_TOKEN`); the delivery fee is always recomputed server-side.
- Throttles: login 5/min, verification resend 1/min, `/geo/reverse` 30/min; username endpoints, `/geo/search` and forgot-password throttled.
- Calendar dates (order number, business-day ETA) use `Asia/Manila`.
- UI: match the `.dc.html` exactly; colors only via the `@theme` tokens in `frontend/src/index.css` (no hex in components); mobile-first; skeleton/empty/error on every list; focus rings; focus-trapped, Esc-closable modals/drawers/menus; touch targets ≥44px; eyebrows are text only (no bar). **No native `<select>`**: always `SearchSelect`.
- Confirmation modals: logout, remove cart item, clear cart, proceed to checkout, place order, cancel order (with reason), delete address.
- Account-gated actions go through `useRequireAuthAction()` (guest → `/login?redirect=<path>`; unverified buyer → `/verify-email`).
- Post media frames are fixed: stage 16/10, `max-height: 560px`, `object-contain`; cards 16/10 `object-cover`; thumbnails square `object-cover`.

## Review Focus

1. **Double "Place order"** (double click, two tabs): exactly one order; the second gets `409 CONFLICT` "Your cart is empty". → Task 4.4.
2. **Server clock in UTC** (Render): an order at `2026-11-23T17:00Z` (Tue 01:00 Manila) is `KK-20261124-…` and its ETA counts from Tuesday. → Tasks 4.1, 4.4.
3. **Open redirect** through `?redirect=//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:…`: ignored, falls back to the role home. → Task 2.4.
4. **Several requests get 401 at once** after the access token expires: one `/auth/refresh`, all retried; a failed refresh clears auth once. → Task 2.4.
5. **Stale cart** between viewing and placing (price changed, product deactivated, stock dropped): the order uses current server prices; inactive or over-stock lines refuse the order with `409` listing them. → Task 4.4.

## Milestone wrap-up (after every milestone)

- [ ] `npm run lint` and `npm test` at the root (both apps) → exit 0.
- [ ] From M2: `npm --prefix backend run migrate:fresh -- --seed` → exit 0, prints the sign-in table.
- [ ] Playwright: every page the milestone touched at 1440 px and 390 px against its `.dc.html` (spacing, sizes, colors, copy, states); fix differences.
- [ ] `/graphify . --update`.
- [ ] Add a "Milestone summary" at the end of this file.
- [ ] Commit on `phase-1`: `feat(m<N>): <summary>`.

## File structure

```
backend/src/
  app.js  server.js
  config/        env.js, db.js, valkey.js, cloudinary.js, mail.js
  clients/       mapbox.client.js, cloudinary.client.js
  middlewares/   auth, permission, verified, rateLimit (.middleware.js), validate.js, error.middleware.js
  schemas/       rules.js (+ UPLOAD_RULES) and <resource>.schema.js
  routes/ controllers/ services/ repositories/ models/   one file per resource
  queues/        email.jobs.js, email.queue.js, workers/email.worker.js
  templates/email/  layout.js + one file per job
  schedulers/    orderExpiry.scheduler.js
  sockets/       index.js (io, adapter, handshake), realtime.js
  utils/         AppError, asyncHandler, response, pagination, cookies, tokens, escapeHtml, businessDays, manilaDate
  constants/     permissions.js, orderStatus.js
  data/          marinduque-locations.json, postal-codes.js
  database/commands/  migrateFresh.js, dbSeed.js
  database/seeders/   <name>.seeder.js, index.js, data/ (media.json, products.js…)
backend/tests/   <area>.test.js, helpers/
frontend/src/
  api/axios.js  app/  routes/  layouts/ (Storefront, Auth, Account, Dashboard)
  pages/<area>/  components/{ui,layout,product,order,post,auth,map}
  hooks/ services/ schemas/ stores/ lib/ constants/
frontend/e2e/    Playwright specs + helpers (latestMailLink, api login)
```

---

## M0 — Scaffold & install

### Task 0.1: Root workspace, backend and frontend scaffolds

**Files:** root `package.json`, `.gitignore`, `.gitattributes`; `backend/{package.json,eslint.config.js,src/app.js,src/server.js,tests/health.test.js}`; `frontend/` from `create-vite` (react), `vite.config.js`, `src/{index.css,main.jsx,App.jsx,lib/format.js,lib/format.test.js}`, `vercel.json`.

**Interfaces:** Produces `app` (default export of `backend/src/app.js`, no `listen`; every supertest imports it) and `formatPeso(centavos) => string`.

- [ ] Repo exists: stay on `phase-1`, no `git init`.
- [ ] Root scripts: `dev` (`concurrently` backend + frontend dev), `setup` (install both), `lint`, `test`, `test:e2e`. `engines.node: ">=22"`.
- [ ] `.gitignore`: `node_modules`, `.env*`, `!.env.example`, `dist`, `coverage`, `backend/storage/`, `graphify-out/`, `_reference/`, `playwright-report/`, `test-results/`, `.claude/settings.local.json`.
- [ ] Backend: PHASE-1-PROMPT M0 packages, `ioredis@^5` (q12), dev `ioredis-mock`. Scripts `dev` (nodemon watching `src/` and `.env` only), `start`, `lint`, `test`, `migrate:fresh`, `db:seed`. Folder tree from PHASE-1-PROMPT M0.
- [ ] Frontend: PHASE-1-PROMPT M0 packages plus `vitest`, `@testing-library/react`, `jsdom`; `npx playwright install chromium`. Tailwind via `@tailwindcss/vite`, no `tailwind.config.js`, `@` → `src`. `index.css` = DESIGN §2 block verbatim + base (`body` Poppins, `ink`, white; links roast/roast-hover; `:focus-visible` 2px roast outline, 2px offset). Poppins 400/500/600/700 from `@fontsource`. `vercel.json` from `_reference/frontend/vercel.json`.
- [ ] Tests: `GET /api/health` → 200 `{ success: true, data: { status: 'ok' } }`; `formatPeso(123456)` → `'₱1,234.56'`, `formatPeso(5000)` → `'₱50.00'`.

### Task 0.2: Env examples and boot check

- [ ] `backend/.env.example` and `frontend/.env.example`: every variable in PRODUCT-SPEC §12 with its default (`SEED_DEFAULT_PASSWORD=KapeKonek@123`, `SEED_EMAIL_BASE=` with a comment), local `PORT=5000`, `CLIENT_URL=http://localhost:5173`, `VITE_API_URL=http://localhost:5000/api`, `VITE_SOCKET_URL=http://localhost:5000`; secrets blank.
- [ ] `npm run dev` starts both; `/api/health` → 200; Playwright: blank page, computed `font-family` starts with `Poppins`, `--color-roast` = `#7B4A2A`.
- [ ] Lint + test; commit `chore(m0): …`. **Stop and ask the user to fill in `.env`.**

---

## M1 — Backend core

### Task 1.1: Env and connections

**Interfaces:** `parseEnv(source) => env` (throws naming every bad key); frozen `env`; `createValkeyConnection(name)` (`maxRetriesPerRequest: null`, TLS when `VALKEY_TLS=true`; the cache connection fails fast while Valkey is down); `connectDb()`/`disconnectDb()`; `sendMail({ to, subject, html, text })` (brevo | log).

- [ ] Tests: `parseEnv({})` names `MONGO_URI` and `JWT_ACCESS_SECRET`; defaults `PORT 5000`, `ORDER_EXPIRY_DAYS 3`, `MAIL_TRANSPORT 'log'`; `brevo` without `BREVO_API_KEY` fails; JWT secrets <32 chars and `CRON_SECRET` <16 fail (q13).

### Task 1.2: Errors, validation, responses

**Interfaces:** `new AppError(status, message, { code, errors, data })`; `sendSuccess(res, { data, message, meta, status })`; `validate({ body, params, query })`; `errorHandler`, `notFound`.

- [ ] Tests: `?limit=5` arrives as `5`; unknown body key stripped; failure → 400 `VALIDATION_ERROR` with `errors['items.0.quantity']`; Mongo 11000 on `email` → 409 `errors.email = 'Email is already taken'`; `CastError` → 404; unknown error → 500 without stack in production; unknown route → 404; malformed JSON → 400.

### Task 1.3: Cursor pagination

**Interfaces:** `cursorFilter({ sortField, direction, cursor })`, `cursorSort({ sortField, direction })`, `pageResult(docs, limit, sortField) => { items, meta }`; cursor = base64url JSON `[sortValue, id]`; repositories fetch `limit + 1`.

- [ ] Tests: 25 docs with 3 distinct prices, pages of 7 asc and desc → all 25 ids once; bad cursor → 400 on `cursor`; Date values round-trip.

### Task 1.4: Cookies and tokens

**Interfaces:** `cookieOptions({ maxAge? })`, `setAuthCookies(res, user, { remember })`, `clearAuthCookies(res)`, `signAccessToken`, `signRefreshToken` (payload `{ sub, tv, rem }`; 30 d with remember, else 1 d — q14), `verifyAccessToken`, `verifyRefreshToken`.

- [ ] Tests: prod `secure:true, sameSite:'none'`; dev `lax`; remember → refresh `maxAge` 30 days; no remember → no `maxAge`/`expires`; access 15 min.

### Task 1.5: Email queue, worker, templates

**Interfaces:** `enqueueEmail(job, data)` (refuses unknown jobs; q16); `emailHandlers[job](data) => { to, subject, html, text }`; `processEmailJob({ name, data })`; `renderLayout({ preheader, heading, bodyHtml, bodyText, cta? })` (espresso header, crema body, roast CTA).

- [ ] Tests: `TEST` job with `name: '<b>x</b>'` writes one file containing `&lt;b&gt;x&lt;/b&gt;` and a text part; unknown job throws; recipient with `isSeed` and no `SEED_EMAIL_BASE` → logged with `note: "skipped-seed"`, Brevo not called; with `SEED_EMAIL_BASE` → sent.

### Task 1.6: Sockets shell, scheduler shell, cron, health, shutdown

**Interfaces:** `initSockets(httpServer)`; `realtime.init(io)`, `realtime.toUser(id, event, payload)` (no-op before init); `runOrderExpiry() => { expired }` with `lock:order-expiry` (`SET NX PX`), body filled in Task 4.5; `POST /api/cron/expire-orders` (`x-cron-secret`).

- [ ] Tests: cron without/wrong secret → 401; correct → 200 `{ expired: 0 }`; health 200 `{ status:'ok', checks:{ mongo, valkey } }`, 503 `degraded` when one is down (q15).
- [ ] `server.js` shuts down in the Global Constraints order, each step in try/catch, hard exit after 10 s.

---

## M2 — Auth, roles & permissions

### Task 2.1: Models, permission matrix, seed commands

**Interfaces:** `PERMISSIONS`, `ROLE_PERMISSIONS` (PRODUCT-SPEC §1 incl. `reviews.update_own`, `reviews.delete_own`), `ROLE_LABELS`; roles/permissions stored as slugs (q17); `runSeeders({ only?, fresh })`; `seedEmail(handle)` → `<base>+<handle>@gmail.com` with `SEED_EMAIL_BASE`, else `kapekonek.<handle>@gmail.com`. User: bcrypt 12, `select:false`, virtuals `fullName`, `initials`, `isSeed`.

- [ ] Tests: seeding twice keeps the same counts (upsert by slug / username); handles `kaluppa`, `manager.santacruz`, `farmer.approved` (verified), `farmer.unverified`, `buyer` (verified), `buyer.unverified`, `buyer01`…`buyer20`, all password `KapeKonek@123`; `seedEmail` both ways; `migrateFresh` in production without `--force` exits non-zero without dropping; the seeder clears `perm:user:*` (waits up to 5 s for Valkey).

### Task 2.2: Permission resolution, guards, rate limiter

**Interfaces:** `resolvePermissions(user)` (cached), `clearPermissionCache(userId)`, `clearAllPermissionCaches()`, `userCan(user, ...slugs)`; middleware `authenticate`, `optionalAuth`, `guestOnly`, `verified`, `role`, `can`, `canAny`; `rateLimit({ name, limit, windowSec, key })` → 429 with `Retry-After`.

- [ ] Tests: kaluppa passes `can('anything.at_all')`; buyer `can('orders.manage')` → 403; second resolve served from cache; cache clear sees a role change; unverified buyer → 403 `EMAIL_NOT_VERIFIED`, unverified farmer passes; suspended → 403; access token with an old `tokenVersion` → 401 (q18).

### Task 2.3: Auth endpoints

**Interfaces:** PRODUCT-SPEC §4 Auth + `POST /auth/refresh` (q2). `/auth/me` → `{ user, roles, permissions }`. Verify/reset tokens: 32 random bytes, sha256 stored, 60 min, single-use (q9). Register `{ firstName, middleName?, lastName, username, email, password, role: 'buyer'|'farmer' }`; login `{ identifier (email or username), password, remember }`.

- [ ] `rules.test.js` (same table as the frontend): `Password123!` ok; `password1`, `Pass!`, `!!!!1111` rejected; `juan.dc_1` ok; `Ju`, `UPPER`, `has space`, 31 chars rejected; `0917 555 0102` ok, `+639175550102` rejected.
- [ ] `auth.test.js`: register → 201, cookies, `VERIFY_EMAIL` queued; duplicate email → 409 `errors.email`; login by username and by email; wrong password → 401 generic; 6th login in a minute → 429; verify token works once, reuse/expired → 400; reset bumps `tokenVersion` and the old refresh → 401; suggestions return exactly 3 free names; forgot-password for an unknown email → 200.

### Task 2.4: Frontend auth foundation

**Interfaces:** `safeRedirect(value, fallback)`; `applyServerErrors(error, setError) => boolean`; `useAuth()` → `{ user, roles, permissions, isLoading, isAuthenticated, isVerified }`; `useCan(slug)`; `<Can permission>`; `useRequireAuthAction() => (fn) => void`; guards `StorefrontRoute`, `GuestRoute`, `ProtectedRoute roles permissions requireVerified`, `RoleRedirect`.

- [ ] Tests: rules table identical to Task 2.3; `safeRedirect` refuses `//evil.com`, `https://evil.com`, `/\\evil.com`, `javascript:alert(1)` and keeps `/orders?x=1`; three parallel 401s → one refresh, three retries; failed refresh clears auth once; `EMAIL_NOT_VERIFIED` → `/verify-email`.

### Task 2.5: Auth pages, dashboard placeholder, 403/404

**Files:** `components/ui/{Button,Input,Label,FieldHint,Textarea,PasswordInput,PasswordRule,RadioCard,Eyebrow,Modal,ConfirmDialog,Spinner,SearchSelect}.jsx`, `layouts/{AuthLayout,DashboardLayout}.jsx`, `pages/auth/*`, `pages/dashboard/Overview.jsx`, `pages/errors/{Forbidden,NotFound}.jsx`.

- [ ] Copy Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Dashboard, Modals (logout) screens. Login checkbox "Remember me". Register: role cards (farmer text "Record your farms and sell beans to Kaluppa. Verify your email to start."), debounced username availability, 3 suggestion chips, password rule. VerifyEmail: resend with 60 s cooldown, "Adding to cart, checking out and reviewing need a verified email." Unverified buyer lands on `/verify-email` after login/register (q19). Logout = confirm → full load of `/` (q20).
- [ ] `SearchSelect` per `SearchSelect.dc.html` / DESIGN §4 (icon tile, round chevron, search, highlight, check, "No match for …", count + key hints, portal, flips up, RHF `Controller`). Tests: filter, ↑↓ Enter pick, Esc, disabled, error, RHF value.
- [ ] Test: `ConfirmDialog` traps focus and closes on Esc.

### Task 2.6: Playwright auth

- [ ] Buyer signup → `/verify-email` → mailbox link → `/`; farmer signup → `/dashboard/overview`; forgot → reset → login; sign in as `buyer` by username; guard: farmer on `/` → `/dashboard/overview`. Playwright runs its own API on 5100 and Vite on 5174 (q23).

---

## M3 — Catalog, posts & seeders

### Task 3.1: Catalog and reviews

**Interfaces:** `listVisibleCategories(viewer)`; `listProducts(viewer, { search, category, variety[], coffeeType[], minPrice, maxPrice (pesos, q25), featured, sort: newest|price_asc|price_desc|rating|popular, cursor, limit≤24 })`; `getProductBySlug(viewer, slug)` (with `inCart` for a signed-in viewer); `canReview(user, productId) => { canReview, reason: null|'not_purchased'|'not_completed'|'already_reviewed', pendingOrderNumber, pendingOrderId }`; `createReview`, `updateReview`, `deleteReview`, `recomputeRating(productId)`. Order + Counter schemas land here (q6).

- [ ] Tests: guest sees Coffee only; farmer sees all three categories; hidden-category slug → 404 for a guest; inactive → 404; `price_asc` and `rating` paging stable across ties; no sold order → 403 `REVIEW_NOT_ALLOWED`; second → 409 `ALREADY_REVIEWED`; each reason from `/reviews/me`; PATCH/DELETE by a non-author → 404; create/edit/delete recompute `ratingAverage` (1 dp) and `ratingCount`; after delete the user can review again; unverified buyer → 403.

### Task 3.2: Settings, delivery info, locations

- [ ] Tests: `/locations` → 6 municipalities, 218 barangays, Boac 4900 … Gasan 4905; `/settings/payment` needs a verified login; `/delivery/info` is public with fee rules, ETA days and pickup; `/settings/landing` public.

### Task 3.3: Posts (read-only)

- [ ] Tests: `/posts/latest?limit=3` newest published, not deleted; `/posts/:id/comments?limit=5` with ≤2 replies each and `replyCount`; `/comments/:id/replies` by cursor; no post write routes exist.

### Task 3.4: Seeders and media

**Interfaces:** `verifyMediaUrl(url) => { ok, contentType }` (200 + `image/*`|`video/*`); `uploadSeedMedia(key, url)` → Cloudinary `seed/<key>`, `overwrite:false`, remote URL on failure; credits in `seeders/data/media.json`.

- [ ] Products, settings (pickup hours sample, q24), 3 hero slides, ~8 posts (text, multi-image with **at least one portrait photo** in "Fresh Liberica roasts are in!", one video) with comments/replies/reactions; demo buyers get sold orders + reviews (≥2 products with ≥12).
- [ ] Tests: `db:seed` twice → no duplicates; demo skipped on a plain second run; `--only=settings` touches only settings; every seeded review's author has a sold order of that product.

### Task 3.5: Storefront UI

**Files:** `layouts/StorefrontLayout.jsx`, `components/layout/{Navbar,Footer,AvatarMenu,MobileMenu}.jsx`, `components/ui/{SectionHeading,ChipToggle,StarRating,QuantityStepper,EmptyState,Skeleton}.jsx`, `components/product/{ProductCard,HeroCarousel,ReviewPanel,ReviewList}.jsx`, `components/post/{Media,MediaViewer,ReactionSummary,CommentThread}.jsx`, `pages/storefront/{Landing,Products,ProductDetail,PostDetail}.jsx`, `lib/quantity.js`, `lib/cloudinary.js`.

- [ ] Copy Main, Products, ProductDetail, PostDetail, Navbar, Footer, Components (review panel states). Landing third "What KapeKonek does" card: bell icon, "Updates", "Know where your order is", "Email and in-app notifications at every step, from confirmation to delivery." Products: filters in the URL, sort `SearchSelect` (`size="sm"`, `icon="sort"`), `useInfiniteQuery` + IntersectionObserver, "Loading more coffee…". Product detail: stepper capped at `stock − inCart` with "N already in your cart · you can add up to M more", `ReviewPanel` states, "Verified purchase". `MediaStage`/`MediaThumb` with Cloudinary `c_limit,w_1600` and `c_fill,g_auto,w_320,h_320`. Add / Cart / Write review through `useRequireAuthAction`.
- [ ] Tests: `stepFor(unit)`, `toSteps`, `squareUrl`.

### Task 3.6: Playwright storefront

- [ ] Landing, products (filter + scroll loads more), product detail, post detail vs screens at 1440/390; guest Add → `/login?redirect=/products/<slug>` → back after login; post media stage height stays the same on every item of the portrait post at both widths.

---

## M4 — Addresses, delivery quotes, cart, checkout, orders

### Task 4.1: Geo, delivery quote, business days

**Interfaces:** mapbox client `drivingDistanceKm(from, to)`, `reverseGeocode(lat, lng)`, `forwardGeocode(query, { bbox, proximity })`; `computeFee(distanceKm, rules)`; `quoteForPoint({ lat, lng }) => { distanceKm, feeCentavos, distanceSource, eta }`; `quoteForAddress(address)`; `findBarangay(municipality, barangay)` (Valkey `geo:brgy:<muni>:<brgy>`, 7 days; misses cached too); `addBusinessDays(date, n)` (Manila); `etaWindow(from = now)`.

- [ ] Tests: 2 km → 5000; 3 km → 5000; 7.2 km → 9200 → 9500; > `maxKm` or outside bounds → 422 `OUTSIDE_DELIVERY_AREA`; Mapbox throws → haversine × 1.35, `fallback`; same 4dp point twice → client called once; no pin + geocode fails → 422 `ADDRESS_NEEDS_PIN`; ETA from Friday → Wed–Fri next week; `2026-11-23T17:00Z` counts from Tuesday.

### Task 4.2: Addresses

- [ ] Tests: first address is default; 11th → 409 "You can save up to 10 addresses"; deleting the default promotes the newest remaining; someone else's → 404; barangay outside municipality → 400 `errors.barangay`; location out of bounds → 400; postal code derived, client value ignored.

### Task 4.3: Cart and uploads

**Interfaces:** `getCart(user) => { lines: [{ product, quantity, inCart, lineTotalCentavos, flags: ('OUT_OF_STOCK'|'OVER_STOCK'|'INACTIVE'|'NOT_PURCHASABLE')[] }], subtotalCentavos, canCheckout }`; `assertQuantityAllowed(product, resultingQty, inCart)` (shared by add, set, checkout); `addItem` (guarded `$inc` with `$elemMatch`), `setQuantity`, `removeItem`, `clearCart`; `createUploadSignature(user, purpose) => { …, folder, allowed_formats, maxBytes }`; `assertUploadAllowed(publicId, kind)` (Cloudinary Admin API; destroys and throws 422).

- [ ] Tests: 0.75 kg → 400; 1.5 pack → 400; farmer adding Coffee → 403; stock 3, 2 in cart, add 2 → 409 `{stock:3, inCart:2, maxAddable:1}`; kg stock 3, 2.5 in cart: +0.5 ok, +1 → 409; PATCH above stock → 409; two parallel adds → `[200, 409]`; stock dropped later → `OVER_STOCK`, `canCheckout:false`; upload rule at 5 MB ok, 5 MB + 1 refused, 10 MB file ok; server re-check rejects big/wrong-format assets; unverified buyer → 403.

### Task 4.4: Order placement

**Interfaces:** `nextOrderNumber(date)` → `KK-YYYYMMDD-NNNN` (Counter `order:YYYYMMDD`, Manila); `placeOrder(user, body)`; `listMyOrders(user, { status, cursor })` (status = one or comma list); `countMyOrders(user)`; `getOrderFor(user, id)`. Notification schema lands here (q6).

- [ ] Tests: each of the 4 combinations succeeds with its fields and fails without (delivery without address, e-wallet without receipt, receipt outside `kapekonek/receipts/`, cash with receipt → 400; pickup without any phone → 400 `errors.contactPhone`; pickup phone saved to the profile); client fee ignored; two concurrent placements → one 201, one 409; stale cart (new price used; inactive → 409 listing it); Manila order number; cart cleared; `ORDER_PLACED` + `KALUPPA_NEW_ORDER` queued; buyer and Kaluppa notifications created.

### Task 4.5: Status machine, cancel, refund, expiry

**Interfaces:** `TRANSITIONS` `{ from, to, who: 'buyer'|'staff'|'system', methods?, requiresReason?, effects[] }`; `transition(actor, orderId, { status, reasonCode, reason, note, rider })`; `cancelByBuyer(user, id, { reasonCode, reason })`; `markRefunded(actor, id, { referenceNumber })`; `expirePendingOrders(now)`.

- [ ] Tests: every allowed transition in PRODUCT-SPEC §3 succeeds, every other pair → 409; `out_for_delivery` on pickup and `ready_for_pickup` on delivery → 409; buyer cancels only own pending; reserve short on item 2 → 409 listing it and item 1 restored; two reserves on the last unit → one wins; cancel/reject after reserved returns stock; `sold` sets `cashCollectedAt` for cash and adds `soldCount`; e-wallet cancelled/rejected/expired → refund `pending`, cash stays `not_applicable`; refund needs a pending refund; expiry touches only pending older than 3 days; expiry racing a reserve leaves it reserved; lock held → `{ expired: 0 }`.

### Task 4.6: Address and order seeders

- [ ] `buyer` gets the three §11 addresses and ~15 orders across all 9 statuses (both methods and payments, rider notes, ETAs, pending refunds and one refunded); extra buyers one address each; fees via `computeFee` with the fallback distance when Mapbox is unset.

### Task 4.7: Cart, address, checkout, order UI

**Files:** `components/order/{CartDrawer,StatusPill,RefundBadge,StatusTimeline,EtaLine,OrderCard,OrderGroupTabs,StatusChips,CancelOrderDialog,DeliveryMethodCards,PaymentCards}.jsx`, `components/ui/FileDrop.jsx`, `components/map/{MapPicker,AddressFormModal,AddressCard}.jsx`, `pages/account/{Addresses,Checkout,Orders,OrderDetail}.jsx`, `constants/{orderStatus,locations}.js` (`MUNICIPALITY_CENTERS`).

- [ ] Copy CartDrawer, Addresses, AddressModal, Checkout, Orders, OrderDetail, Modals. Cart drawer: stepper capped at stock ("That is all we have"), stacked Checkout/Clear, Checkout disabled while a warning shows; a 409 toasts the server's numbers and refetches. Address modal: new address starts on all of Marinduque with no pin, barangay disabled until a municipality; municipality → `flyTo` zoom 12.5 + pin to center; barangay → `flyTo` 15 + pin + dashed ring; select moves carry `source:'select'` and **never** call `/geo/reverse`; click/drag/search/"Use my location" do; own zoom buttons (+, −, fit) and zoom label bottom-left; `jumpTo` under reduced motion. Checkout: `FileDrop kind="image"` receipt with the too-large state; QR via `qrcode.react` with SAMPLE badge. OrderDetail full width (no chat column). Every confirmation modal from Global Constraints.
- [ ] Tests: order group → statuses mapping; `FileDrop` refuses 5.1 MB with "… is 5.1 MB. Images can be up to 5 MB."

### Task 4.8: Playwright orders

- [ ] Delivery: verified buyer adds an address by dropping a pin → checkout → delivery + cash on delivery → pending → cancel with reason → no refund badge. Pickup: second order → pickup + GCash with a receipt → pending. 6 MB receipt refused. Address zoom: municipality → 12.5, barangay → 15 + ring, no `/geo/reverse` requests. Guard: unverified buyer on `/checkout` → `/verify-email`.

---

## M5 — Notifications & live order updates

### Task 5.1: Socket auth and rooms

- [ ] Tests: handshake without a valid `accessToken` cookie refused; `realtime.toUser` reaches only that user's sockets; no `conversation:*` or `message:*` handlers.

### Task 5.2: Notifications and status emails

- [ ] Endpoints (cursor list, unread count, read one, read all); notifications for every §7 event with `notification:new`; every status change emits `order:updated` and queues `ORDER_STATUS_CHANGED` (rider / pickup address + hours / reason + refund note). Tests: unread count after events; read-all; another user's notification → 404; no `chat.*` permission; `GET /api/conversations/x/messages` → 404.

### Task 5.3: Frontend realtime

- [ ] `lib/socket.js` + `hooks/useRealtime.js` invalidating notification and order queries; navbar bell dropdown (unread count, mark all read, load more). Playwright: Kaluppa moves the buyer's order to *out for delivery* through the API → in a second context the bell count and the status banner (with rider) update without reload.

---

## M6 — Profile & settings

### Task 6.1: Account endpoints

- [ ] `GET/PATCH /account/profile`, `PATCH/DELETE /account/avatar` (server upload re-check; destroy the old asset), `PATCH /account/email` (current password; unverifies, `VERIFY_EMAIL` to new, `EMAIL_CHANGED_NOTICE` to old), `PATCH /account/password` (current password; `tokenVersion++`; re-issue this session's cookies). Tests: username taken → 409; email change flow; another session's refresh fails after a password change.

### Task 6.2: Profile and Settings pages

- [ ] Copy Profile.dc.html (avatar via `FileDrop`, 5 MB) and Settings.dc.html; no side menu. Playwright: both flows.

---

## M7 — Polish & verification

- [ ] Every Phase 1 page at 1440/390 vs its screen; fix.
- [ ] Accessibility: labels, focus order, keyboard menus/drawer/modals/`SearchSelect`, contrast; axe on buyer pages (visible label inside the accessible name).
- [ ] `/impeccable` polish + audit within the screens; taste review.
- [ ] Route-level `lazy()`, Cloudinary `f_auto,q_auto,w_…`, lazy images, `staleTime` 30 s.
- [ ] `grep -rn "<select" frontend/src` is empty.
- [ ] `README.md`: setup, env, commands, seed sign-in table, deploy notes (Render health check `/api/health`, Vercel, cross-site cookies).
- [ ] PHASE-1-PROMPT §4 checklist all green.

---

## Milestone summaries

(Added after each milestone.)
