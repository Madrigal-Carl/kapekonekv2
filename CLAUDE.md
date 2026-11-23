# KapeKonek — Project Rules for Claude

These rules apply to every task in this repository, in every phase. If a request conflicts with them, say so before writing code.

Read these too, in this order, before your first task in a session:
1. `docs/PRODUCT-SPEC.md`: what Phase 1 does (roles, data, endpoints, pages, statuses, seeds).
2. `docs/PHASE-2-SPEC.md`: the dashboard for farmers, Group Managers and Kaluppa. Where it differs from PRODUCT-SPEC, it wins.
3. `docs/DESIGN.md`: how it looks (tokens, components, the screen files to copy; §8 is the dashboard).
4. `docs/design/screens/*.dc.html`: the approved screens. **The UI must match them.**

Precedence when they disagree: the user's latest message → this file → PHASE-2-SPEC → PRODUCT-SPEC → DESIGN → phase prompt.

## What KapeKonek is

A coffee marketplace with a CRM side, built for Kaluppa in Marinduque.

- **Kaluppa is the only seller and does all fulfilment.** Farmers sell beans *to* Kaluppa. Buyers order **coffee** from Kaluppa. Farmers will later order **fertilizer and seedlings**.
- **Fulfilment**:
  - **Delivery** anywhere in Marinduque. The fee is calculated server-side from the Mapbox road distance to Kaluppa, and the order arrives 3–5 business days after confirmation.
  - **Pickup at Kaluppa** (Pantayin, Santa Cruz, Marinduque).
  - There are no pickup stations and no Station Partners.
- **Payment**: e-wallet (GCash/Maya QR + receipt upload), or cash (cash on delivery / cash on pickup).
- **Addresses**: buyers keep an address book (up to 10, one default) with a Mapbox map pin that auto-fills the fields; typing it all by hand also works.
- **No order chat.** Buyers follow their order through statuses, email and in-app notifications. The dashboard **Inbox** (Phase 2) is separate: it's for farmers, Group Managers and Kaluppa, and it's never tied to an order.
- **Phase 2** (dashboard):
  - farmer approval by Group Managers;
  - farms, trees and harvests;
  - bean sales to Kaluppa (5 kg cap until approved);
  - the farmer store;
  - Inbox, Hub, Farm Map;
  - Kaluppa orders, inventory, settings, reports and the audit log.

| Role | Slug | Home after login | Created by | Must verify email to act? |
|---|---|---|---|---|
| Kaluppa (acts as admin) | `kaluppa` | `/dashboard/overview` | seeder | no |
| Group Manager | `group_manager` | `/dashboard/overview` | Kaluppa (seeder in dev) | no |
| Farmer | `farmer` | `/dashboard/overview` | signup, or a Group Manager | **yes** (Group Manager-created accounts are pre-verified) |
| Buyer | `buyer` | `/` | signup | **yes** |

The storefront (`/`, `/products`, `/products/:slug`, `/posts/:id`) is for **guests and buyers**, and in Phase 2 also for **farmers** (Store → `/products`, `/products/:slug`, cart, `/checkout`). Each user only sees the categories their permissions let them buy. Group Managers and Kaluppa are redirected to `/dashboard/overview`. Farmers' orders, addresses and account pages live under `/dashboard`. Buyer account pages: `/checkout`, `/orders`, `/orders/:id`, `/addresses`, `/profile`, `/settings`.

## Repository layout

```
kapekonek/
├── backend/          Express 5 API + Socket.IO + BullMQ worker + expiry scheduler (one process)
├── frontend/         React 19 + Vite SPA
├── docs/
│   ├── PRODUCT-SPEC.md
│   ├── DESIGN.md
│   ├── design/screens/   approved Claude Design screens (.dc.html) — source of truth for the UI
│   ├── prompts/          phase prompts
│   └── plans/            superpowers plans
├── _reference/       AgriCentral sample (backend/, frontend/) — read-only. Copy patterns; never import from it or edit it.
├── package.json      root scripts (dev runs both apps)
└── CLAUDE.md
```

Language: **JavaScript (ES modules)** on both sides. No TypeScript. Use JSDoc on public service and repository functions.

## Backend request flow (mandatory)

```
route → authenticate / optionalAuth → verified → can()/role() → validate() → controller → service → repository → Mongoose model
```

- **Routes** only wire middleware and the controller. No logic.
- **Auth middleware comes before validation**, so logged-out or forbidden requests are rejected before any validation runs.
- **validate()** is one shared helper, `validate({ body, params, query })`, taking Zod schemas from `src/schemas/`. It replaces `req.body`/`req.params` with parsed data and redefines `req.query` (Express 5 makes it getter-only; see `_reference/backend/src/validators/crop.validator.js`). Do not copy the sample's per-file duplicated helpers.
- **Controllers** read `req`, call one service function, send the response. No business rules, no model access.
- **Services** hold every business rule: permission-dependent behaviour, the order state machine, stock, delivery quotes, refunds, queueing emails, emitting socket events, creating notifications. Services call repositories, never models. Calls to outside APIs (Mapbox, Cloudinary, Brevo) live in small client modules under `src/clients/`, used only by services.
- **Repositories** are the only files that import models. One per aggregate. Intent-named functions (`findPurchasableBySlug`, `reserveStock`, `listByBuyerCursor`), not a generic pass-through.
- **Errors**: services throw `AppError(statusCode, message, { code, errors })`. One error middleware formats every response, including Mongo duplicate-key errors (→ `409 CONFLICT` with the field in `errors`). Controllers are wrapped in `asyncHandler`.
- **Realtime**: services emit through a `realtime` module (`realtime.toUser(id, event, payload)`; Socket.IO is used only for notifications and live order updates). Controllers and repositories never touch Socket.IO.

### Response shape

```json
{ "success": true, "message": "Optional", "data": { }, "meta": { "nextCursor": "…", "hasMore": true } }
{ "success": false, "message": "Human readable", "code": "VALIDATION_ERROR", "errors": { "email": "Email is already taken" } }
```

`errors` is a flat `field → message` map so the frontend can call react-hook-form's `setError` directly. Codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `EMAIL_NOT_VERIFIED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `SERVER_ERROR`.

### Lists, money, quantities

- Infinite-scroll and "load more" lists use **cursor pagination** (`?cursor=&limit=` → `meta.nextCursor`, `meta.hasMore`). One shared helper in `utils/pagination.js` encodes `(sortValue, _id)` so non-unique sorts stay stable.
- Money is **integer centavos** (`priceCentavos`). Format as PHP only in the frontend: `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
- Quantity step by unit: `kg` → 0.5 steps (min 0.5); `pack`, `piece` → whole numbers (min 1). Same Zod rule on both sides. Line total = `Math.round(priceCentavos * quantity)`.
- Cart quantity: adding **adds to** the existing line and the result must be ≤ stock (`409 QUANTITY_EXCEEDS_STOCK` with `maxAddable`). One helper for add, update and checkout. Steppers are capped in the UI too.
- **Selects**: never a native `<select>`; always `components/ui/SearchSelect.jsx`.
- **Uploads**: `UPLOAD_RULES` — images ≤ 5 MB, other files ≤ 10 MB. Checked in the browser and re-checked on the server from Cloudinary's stored `bytes`.
- **Reviews**: only with a `sold` order containing the product; one per user per product; the author can edit or delete their own (`reviews.update_own`, `reviews.delete_own`).

## Roles and permissions (Spatie-style)

- Collections `Role { name, slug, permissions[] }`, `Permission { name, slug, group }`. Users have `roles[]` and optional direct `permissions[]`.
- Slugs are `resource.action`. The full matrix is in `docs/PRODUCT-SPEC.md` and the role/permission seeder.
- `kaluppa` is the super-admin: `can()` always passes for it (like Spatie's `Gate::before`).
- Resolved permissions are cached in Valkey (`perm:user:<id>`, 10-minute TTL), cleared when a user's roles/permissions change and when the seeder runs.
- Backend middleware: `role(...slugs)`, `can(...slugs)` (all required), `canAny(...)`.
- Frontend: `/auth/me` returns `{ user, roles, permissions }`. Use `useCan(slug)`, `<Can permission>`, `<ProtectedRoute roles permissions requireVerified>`.
- **Check permissions, not roles, for features.** Never write `role === 'buyer'` in cart/order/address/review/post code. What a user may buy is decided by the product category's `purchasePermission` (`catalog.coffee` for Coffee; `catalog.farm_supplies` for Fertilizer and Seedlings). Roles are only for routing.

## Email verification rule

- **Buyers** must verify before any authenticated action (cart, checkout, orders, addresses, reviews, profile, settings, notifications). Unverified buyers can still view public storefront pages.
- **Farmers** must verify too (Phase 2) before using the dashboard. Farmers created by a Group Manager are pre-verified, but they must set a new password at first sign-in if `mustChangePassword` is set.
- Group Managers and Kaluppa may use their dashboards while unverified.
- Backend: `verified` middleware → `403 { code: "EMAIL_NOT_VERIFIED" }` for unverified users holding the `buyer` or `farmer` role. Apply it to every route those roles use.
- Frontend: the axios interceptor sends the user to `/verify-email` on that code.

## Frontend data flow (mandatory)

```
Zod schema (react-hook-form) → TanStack Query hook → service function → axios instance
```

- `services/*.service.js`: plain async functions calling `api`, returning `response.data.data` (plus `meta`). No React.
- `hooks/use<Resource>.js`: query-key factory + `useQuery` / `useInfiniteQuery` / `useMutation` wrappers, like `_reference/frontend/src/hooks/useCrops.js`. Mutations invalidate by key factory. Components never call services directly.
- `schemas/*.schema.js`: shared Zod schemas. Rules that exist on both sides (password, username, phone, quantity step) live in `schemas/rules.js` and must match the backend.
- `applyServerErrors(error, setError)` maps API errors onto form fields.
- Zustand holds only client state (auth user, cart drawer open). Server data stays in TanStack Query.

## Config and infrastructure (copy from `_reference/backend/src/config`)

- `config/env.js` loads dotenv **and validates every variable with Zod at boot**.
- `config/valkey.js` is a **factory** `createValkeyConnection(name)` (ioredis, `maxRetriesPerRequest: null`, TLS when `VALKEY_TLS=true`). Queue, worker, Socket.IO adapter pub/sub, and cache/rate-limiter each get their own connection.
- `config/cloudinary.js`: signed direct uploads (`_reference/backend/src/services/upload.service.js`). Types: `avatar`, `receipt` (images) and seeder-only `product`, `post` (images and video).
- `config/mail.js`: Brevo client, plus `MAIL_TRANSPORT=log` that writes emails to `backend/storage/mail/` for local dev and tests.
- **Every email goes through BullMQ** (`_reference/backend/src/queues/`: job constants, worker with a handler map, templates, 3 attempts, exponential backoff). Escape user text in templates.
- **Worker and the order-expiry scheduler run inside the API process** (Render single web service). Scheduler follows `_reference/backend/src/schedulers/requestAutoDeny.scheduler.js`. On `SIGTERM`/`SIGINT` close: HTTP → Socket.IO → scheduler → worker → queue → Valkey → Mongo.
- **Cookies**: `accessToken` (15 min) and `refreshToken` (30 days when "Remember me" is checked, else session cookie; the checkbox label is just "Remember me"), `httpOnly`, all set through one `cookieOptions()` helper (prod: `secure: true, sameSite: 'none'`; dev: `sameSite: 'lax'`). Never repeat the sample's `sameSite: 'strict'` refresh bug.
- Refresh tokens carry `tokenVersion`; password change/reset increments it.
- **Maps use Mapbox GL JS** via `react-map-gl` + `mapbox-gl`, with the public token in `VITE_MAPBOX_TOKEN`. **Directions and geocoding run only on the backend** with `MAPBOX_ACCESS_TOKEN`, through `/geo/*` and `/delivery/quote`. The delivery fee is always recomputed server-side.

## UI rules

- **Match `docs/design/screens/` exactly**: layout, spacing, sizes, copy, colors, states. `docs/DESIGN.md` maps each screen to a route and lists the components to extract. If something in the screens is a placeholder (photos, `[Address]`), use real data from the API instead.
- Coffee palette tokens live once in `frontend/src/index.css` via Tailwind v4 `@theme`. No hex values in components.
- Mobile-first. Every list has skeleton, empty and error states.
- **Confirmation modals** for: logout, removing a cart item, clearing the cart, proceeding to checkout, placing an order, cancelling an order (with reason), deleting an address.
- Account-gated actions go through `useRequireAuthAction()`: guest → `/login?redirect=<path>`; unverified buyer → `/verify-email`; else run.
- Role display names in the UI ("Group Manager", not `group_manager`). English only.
- Accessible: labelled inputs, focus rings, keyboard-operable menus/drawers/modals (focus trap, Esc closes).

## Icons and buttons (Change 05)

- **Icons**: only `react-icons`, Lucide set (`react-icons/lu`), imported through `components/ui/icons.js`. The only custom SVGs allowed are the logo mark, the reaction badges and map pins.
- **Buttons**: every button and button-styled link is `<Button variant size …>` from `components/ui/Button.jsx` (see `Buttons.dc.html`). Never style a raw `<button>` outside `components/ui/`.

## Phase 2 rules (dashboard)

- **Scope by policy, not by role.** Records use the policy helpers in PHASE-2-SPEC §2 (`isOwner`, `isAssociationManager`, `isAssignedManager`, `isKaluppaFarm`). A Group Manager acting for a farmer always sends `farmerId`, and the service checks that the farmer is in the Group Manager's association.
- **Two farmer states, two words:** "email verified" and "approved farmer". Never call an approved farmer "verified" in code, copy or tests.
- **The 5 kg bean cap** is enforced in the service inside a transaction (PHASE-2-SPEC §3.5). The UI meter is only a hint.
- **Every management page** = page header + `DataTable` (search left; plain filter dropdowns right, Status first; no tabs; row actions, numbered pages, URL-synced) + right **drawer** for add/edit/view + **modal** for archive/restore/reject/cancel/remove. Archive is a soft delete with Restore.
- **Maps**: the address/farm/branch pickers share one `MapPicker`. Picking from the dropdowns flies the map and moves the pin without reverse-geocoding. Only a manual click or drag reverse-geocodes.
- **Media frames are fixed** (16:10 stages and grids; cover in grids, contain in viewers). A tall or wide upload must never change a card's height.
- **Inbox** read state uses member cursors (`lastDeliveredAt`, `lastReadAt`), not per-message writes. Read-only membership keeps history.
- **Audit**: every create/update/archive/approve/reject/status change in Phase 2 services calls `audit.record(...)` with allow-listed fields only, never passwords or documents.
- **Seeds**: `@gmail.com` addresses, password `KapeKonek@123`. Never email a seed account unless `SEED_EMAIL_BASE` is set (PHASE-2-SPEC §8).

## Skills to use

- **superpowers**: brainstorm → plan → execute, one milestone at a time. Plans go in `docs/plans/`. Decisions in the docs are settled; brainstorm only *how* to build, never *whether*.
- **ponytail**: keep code lean *inside* each layer. It must not remove the mandatory layers, guards, validation, confirmation modals or queueing.
- **impeccable**: polish within the approved screens (`/impeccable teach` with `docs/DESIGN.md`). It must not redesign them. **taste** (`design-taste-frontend`): review pass only.
- **playwright** / **browser-use**: click through every finished flow and compare screenshots with the approved screens.
- **graphify**: `/graphify . --update` after each milestone; read `graphify-out/GRAPH_REPORT.md` before large refactors.

## Definition of done (every task)

1. Backend and frontend flows followed exactly.
2. Zod rules match on both sides.
3. `npm run lint` and `npm test` pass in both apps.
4. `npm run migrate:fresh -- --seed` succeeds on a clean database.
5. Flow clicked through with Playwright (happy path + one guard: guest, unverified buyer or wrong role), and the screen matches its `.dc.html` design.
6. No secrets committed; `.env.example` updated for new variables.
7. Commit on the phase branch with a clear message.
