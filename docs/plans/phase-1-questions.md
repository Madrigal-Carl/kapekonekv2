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
| 9 | Token lifetimes for verify-email / reset-password links. | Verify 24 h, reset 60 min, both single-use (sha256 hash stored). |
| 10 | Timezone for order-number dates and business-day ETAs (server runs UTC). | `Asia/Manila` for both. |
| 11 | BUILD-GUIDE says wait for OK before M0; the first message said start M0. | Followed the message: plan, then M0, then stop for `.env`. |
