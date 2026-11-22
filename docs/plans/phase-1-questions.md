# Phase 1 — open questions and the choices made

Each item was missing or contradictory in the docs. The choice is applied; change it if you disagree.

| # | Question | Choice |
|---|---|---|
| 1 | Spec says Node 22; this machine runs Node 24. | `engines.node: ">=22"`. Render can use 22 LTS. |
| 2 | No refresh endpoint is listed, but a 15-min access cookie + refresh cookie need one. | Add `POST /api/auth/refresh` (no guard; reads the refresh cookie, checks `tokenVersion`, re-issues both cookies). |
| 3 | `npm test` must pass in the frontend, but no frontend test runner is listed. | Add `vitest` (M0), plus `@testing-library/react` and `jsdom` when component tests start (M2). |
| 4 | Permission cache and rate limiter need Valkey in unit tests. | Add `ioredis-mock` as a backend dev dependency (M2); BullMQ is mocked at `enqueueEmail` in tests. |
| 5 | Location data: spec says `backend/src/data/`, the M0 folder list only has `database/seeders/data`. | `backend/src/data/` — it is runtime data for `GET /locations`, not seed-only. |
| 6 | Review eligibility (M3) and demo reviews need sold orders, but Order/Counter are listed in M4. Placing an order (M4) creates notifications, listed in M5. | Order + Counter schemas land in M3; the Notification schema lands in M4 (no Conversation — Change 01); their endpoints stay in M4/M5 as planned. |
| 7 | `migrate:fresh` / `db:seed` scripts are listed in M0, the commands in M3, but M2 needs role/user seeding. | Scripts added in M0; the command runner with roles + users seeders lands in M2; M3 adds the remaining seeders. |
| 8 | Which product sorts? | `newest` (default), `price_asc`, `price_desc`, `rating`, `popular` (soldCount) — final list follows `Products.dc.html`. |
| 9 | Token lifetimes for verify-email / reset-password links. | Both 60 min (the VerifyEmail and ForgotPassword screens say so), single-use, sha256 hash stored. Changed in M2 from "verify 24 h" to match the screen copy. |
| 10 | Timezone for order-number dates and business-day ETAs (server runs UTC). | `Asia/Manila` for both. |
| 11 | BUILD-GUIDE says wait for OK before M0; the first message said start M0. | Followed the message: plan, then M0, then stop for `.env`. |
| 12 | `npm i ioredis` installed v6, but `ioredis-mock` (needed for Valkey unit tests) only supports v5. | Pinned `ioredis@^5.11` (bullmq 6 and `@socket.io/redis-adapter` accept ≥5; the reference app uses 5.x). `ioredis-mock` moved from M2 to M1. |
| 13 | Minimum secret lengths are unspecified. | `env.js` requires `JWT_*_SECRET` ≥32 characters and `CRON_SECRET` ≥16; the app refuses to boot otherwise. |
| 14 | Refresh-token JWT lifetime without "remember me" (the cookie is a session cookie). | 1 day, as in `_reference`; with remember me, 30 days. The choice rides in the token (`rem`). |
| 15 | Health check response when a dependency is down. | `503` with `{ status: 'degraded', checks: { mongo, valkey } }`, so Render's health check sees it. |
| 16 | `EMAIL_JOBS` lists every job in the plan, but only `TEST` has a template in M1. | Each job is added with its template in the milestone that needs it (VERIFY_EMAIL/RESET_PASSWORD in M2, …); `enqueueEmail` refuses unknown names. |
| 17 | How users reference roles/permissions (ids or slugs). | Slugs on `User.roles`/`permissions` and `Role.permissions`: no joins, `/auth/me` returns them as-is, and slugs never change. |
| 18 | Plan said an access token stays valid after a password change until it expires (15 min). | Access tokens are also checked against `tokenVersion` (the user is loaded anyway), so the reset screen's "You'll be signed out of other devices" is immediate. |
| 19 | Where an unverified buyer lands after login/register. | `/verify-email` (matches Register.dc.html "Create account" → VerifyEmail); a `?redirect=` is ignored until they verify. |
| 20 | Logout went to `/login?redirect=…` because the page guard reacted before the redirect to `/`. | Logout does a full page load of `/`, which also drops every cached query of the old account. |
| 21 | Design markup quirk: on Login/ForgotPassword the "← Back" link and the eyebrow are both inline-flex, so they share one line. | Stacked (the eyebrow's 28 px top margin shows that was the intent). |
| 22 | `/` before the storefront exists (M3), yet M2 flows land there. | A small placeholder page (sign in / sign up, or welcome + log out); M3 replaces it. |
| 23 | E2E reused the dev servers, whose nodemon restarted on every logged email. | nodemon watches `src/` and `.env` only; Playwright starts its own API on 5100 and Vite on 5174. |
| 24 | Pickup opening hours are `[Opening hours]` in the spec and screens; Kaluppa's real hours are unknown. | Seeded as a sample, "Monday to Saturday, 8:00 AM to 5:00 PM" (`constants/settings.js`). Kaluppa should confirm; it changes in one setting (`pickup.location`). |
| 25 | Product price filter unit. | `minPrice`/`maxPrice` are pesos (what the buyer types in the Price (₱) boxes); the service converts to centavos. |
| 26 | CLAUDE.md says farmers must verify their email (marked "Phase 2"); PRODUCT-SPEC and PHASE-1-PROMPT say farmer signup → dashboard without verifying. | Phase 1 keeps the PRODUCT-SPEC behavior (unverified farmers reach the placeholder dashboard with the unverified banner). Change 04 also puts the farmer rule in Phase 2 M8. |
