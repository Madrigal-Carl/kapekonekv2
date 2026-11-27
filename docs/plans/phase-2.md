# KapeKonek Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dashboard for farmers, Group Managers and Kaluppa on top of Phase 1: onboarding and approval, associations and Group Managers, farms/trees/harvests, bean sales with the 5 kg cap, farmers in the store, Kaluppa orders/inventory/reviews/settings, Inbox, Hub with the landing top 3, Farm Map, overviews, reports and the audit log. Every page matches its `.dc.html` for every role that can open it.

**Architecture:** Extend, don't rewrite. Same backend flow (`route → authenticate → verified → can() → validate() → controller → service → repository → model`); record scope comes from four policy helpers, never `role ===`. Dashboard pages share one `DashboardLayout` (Sidebar + DashTopbar) and one management pattern: `PageHeader` + `DataTable` (URL-synced) + right `Drawer` + `ConfirmModal`. Realtime stays in the `realtime` module; new jobs (`beans:expire`, `posts:top3`) are BullMQ repeatables inside the API process.

**Tech Stack:** Phase 1's stack. No new runtime dependencies are planned; add one only if a task can't be done with what is installed (ledger it).

**Spec:** `CLAUDE.md` (Phase 2 rules), `docs/PHASE-2-SPEC.md` (wins over PRODUCT-SPEC), `docs/PRODUCT-SPEC.md`, `docs/DESIGN.md` §8, `docs/prompts/PHASE-2-PROMPT.md`, `docs/design/screens/*.dc.html` (DESIGN §8.4 map; every Tweaks branch). Gaps and choices: `docs/plans/phase-2-questions.md`. Patterns: `_reference/` and `_reference/original/backend/src/{models,services}/{farm,tree,harvest,coffeeBean,auditLog}*` (copy ideas, never import).

## Global Constraints

- Phase 1 Global Constraints (`docs/plans/phase-1.md`) all still hold. Branch `phase-2` from `phase-1`. **Stop after each milestone** for the user.
- Permissions: exactly the PHASE-2-SPEC §2 matrix. Features check permissions; record scope uses `isOwner`, `isAssociationManager`, `isAssignedManager`, `isKaluppaFarm` (in `services/policy.service.js`). A Group Manager acting for a farmer always sends `farmerId`, and the service checks that farmer is in its association.
- Words: "email verified" vs "approved farmer". Never "verified farmer" in code, copy or tests.
- Farmers must verify their email before any dashboard route (`403 EMAIL_NOT_VERIFIED`); Group Manager-created farmers are pre-verified and pre-approved; `mustChangePassword` → "Set a new password" before anything else.
- Management pages: `PageHeader` + `DataTable` (search left; plain `SearchSelect size="sm" searchable={false}` filters right, **Status first**, "Clear filters" before them; no tabs or count chips; numbered pages; row actions; URL `?status=&q=&<filters>&page=`; drawers `?open=<id>&mode=view|edit|add`) + `Drawer` (600–720 px, DESIGN §8.2 spacing) + `ConfirmModal` for archive/restore/reject/cancel/remove. Archive = `archivedAt` + Restore.
- Dashboard lists are page-based: `?page&limit≤50` → `data: items`, `meta: { page, limit, total }` (q3, q4). Feeds and messages use cursors.
- Every create/update/archive/restore/approve/reject/status change in a Phase 2 service calls `audit.record()` with allow-listed fields only (never passwords, tokens or documents); jobs record as `system`.
- The **5 kg cap** is enforced in the service inside a transaction that bumps a per-farmer lock document; `403 BEAN_CAP_EXCEEDED {capKg:5, usedKg, leftKg}`. The UI meter is a hint.
- Media frames are fixed: feed grid 16:10 cover (1 / 2 / 1+2 / 2×2 "+N"); viewer stage 16:10, max 560 px, contain; thumbnails square cover. No upload changes a card's height.
- Inbox read state uses member cursors (`lastDeliveredAt`, `lastReadAt`), never per-message writes. Ended memberships keep history with `canPost:false`, `leftAt`.
- Maps: one `MapPicker` for address, farm and branch. Select-driven pin moves fly and never reverse-geocode; manual click/drag does.
- Validation (shared Zod, both sides): lot 1–40; size 0.01–500 ha; tree count 1–100 000; yield 0.5–100 000 kg in 0.5 steps; bean weight 0.5–10 000 kg in 0.5 steps; price ₱1–₱10 000/kg; bean photos 1–5; notes ≤ 500; reasons 5–300; message ≤ 2000; post ≤ 5000; comment ≤ 1000; tags ≤ 3 of `pruning, harvesting, processing, soil, advisory, announcement`; association name 2–80, description ≤ 500; dates not in the future. Uploads: image 5 MB, file (pdf) 10 MB, video (mp4/webm) 50 MB for `post_media` only (q8).
- Colors: chart palette DESIGN §8.3 in that order; every chart has a legend or labels and "View as table"; one y-axis. Tokens only in `index.css`.
- Seeds: `@gmail.com` handles via `seedEmail()`, `KapeKonek@123`, `isSeed` mail guard. Email jobs skip recipients with no email (q13).

## Review Focus

1. **A Group Manager sends another association's `farmerId`** (farm, tree, harvest, bean, farmer edit, Kaluppa-farm assignment): 404, nothing written, no audit entry. → tests in Tasks 8.4, 9.1, 9.2, 10.1.
2. **Email-less farmer** (Group Manager-created, username only) hits every email path — approval, bean decisions, order status, forgot password by username: no crash, no queued job without a recipient, generic 200 on forgot-password. → Tasks 8.1, 8.4, 10.2.
3. **Archived Group Manager with an open session**: the next request is 401 and the refresh fails; their association's pending requests now route to Kaluppa. → Task 8.3.
4. **Removal or transfer while the farmer is mid-flow**: the cap applies again only to listings created after the removal (`countsTowardCap` is set at creation); the old group chat is read-only at once (a send → 403) and the open socket gets `conversation:updated`. → Tasks 8.4, 10.1, 12.1.
5. **Two decisions on one request** (Group Manager and Kaluppa, or a double click on Approve): exactly one wins via a conditional update on `status:'pending'`; the other gets `409 CONFLICT`. Same for bean approve/reject. → Tasks 8.4, 10.2.

## Milestone wrap-up (after every milestone)

- [ ] `npm run lint`, `npm test` (both apps, Phase 1 suites included) → exit 0.
- [ ] `npm --prefix backend run migrate:fresh -- --seed` → exit 0, sign-in table printed.
- [ ] Playwright: every page the milestone touched, **for each role that can open it**, at 1440 px and 390 px, against its `.dc.html` (every Tweaks branch); plus the full Phase 1 e2e suite.
- [ ] `/graphify . --update`; milestone summary at the end of this file; commit on `phase-2`: `feat(m<N>): <summary>`. **Stop.**

## File structure (additions)

```
backend/src/
  models/        association, farmerProfile, conversation, conversationMember, message, auditLog,
                 farm, treeGroup, harvest, beanListing, postView (+ changes: user, post, review, product, setting, notification)
  services/      policy, audit, chat, association, groupManager, farmer, farmerProfile, dashboard,
                 farm, treeGroup, harvest, bean, adminOrder, inventory, reviewModeration, adminSettings,
                 inbox, hub, postTop, farmMap, report, auditLog
  queues/        jobs.queue.js (repeatables: beans:expire, posts:top3), workers/jobs.worker.js
  utils/         pageList.js (page-based lists), csv.js
frontend/src/
  layouts/DashboardLayout.jsx   components/dashboard/{Sidebar,DashTopbar,PageHeader,KpiTile,StageBar,CapMeter,BarChart,DataTable,Drawer,ConfirmModal,StatusPill}.jsx
  components/map/MapPicker.jsx (shared)   components/inbox/*   components/hub/*
  pages/dashboard/<area>/*      hooks/use<Area>.js   services/<area>.service.js   schemas/<area>.schema.js
```

---

## M8 — Dashboard shell, permissions, farmer onboarding, accounts

### Task 8.1: Permissions, policies, verification, first password

**Files:** `constants/permissions.js`, `database/seeders/roles.seeder.js`, `services/policy.service.js`, `middlewares/verified.middleware.js`, `models/user.model.js`, `services/auth.service.js`, `schemas/auth.schema.js` (+ frontend), `routes/auth.routes.js`; tests `tests/policy.test.js`, `tests/permissions.test.js`, `tests/auth.test.js`.

**Interfaces:** `isOwner(user, record)`, `isAssociationManager(user, associationId)`, `isAssignedManager(user, farm)`, `isKaluppaFarm(farm)` (sync, take loaded docs/ids; the Group Manager's association comes from `Association.groupManager`, cached on `req.user.associationId` by `authenticate`). User: `email` sparse unique, optional only with `createdBy`; `mustChangePassword`, `createdBy`. `PATCH /auth/password/first {newPassword}` (only when `mustChangePassword`; clears it, bumps `tokenVersion`, re-issues cookies). `/auth/me` adds `mustChangePassword`, `associationId`, `farmerStatus`.

- [ ] Tests: role matrix equals PHASE-2-SPEC §2 for every role × slug; each policy true/false table (owner, other owner, Group Manager of the record's association, another association, assigned manager of a Kaluppa farm, Kaluppa farm detection); unverified farmer → 403 `EMAIL_NOT_VERIFIED`, unverified Group Manager passes; farmer signup without `contactNumber` → 400; first-password: refused when the flag is false, succeeds once, old refresh → 401; forgot-password with a username of an email-less user → 200, no job queued.

### Task 8.2: Audit, chat memberships, page lists, upload purposes

**Files:** `models/{auditLog,conversation,conversationMember}.model.js`, `services/{audit,chat}.service.js`, `utils/pageList.js`, `schemas/rules.js` (both sides: `UPLOAD_RULES.video`, `file` = pdf), `services/upload.service.js` (purpose `farmer_document`: image|pdf); tests `tests/audit.test.js`, `tests/chat.test.js`, `tests/pageList.test.js`, `tests/uploads.test.js`.

**Interfaces:** `audit.record({ actor|null, area, action, entity: {type, id, label}, before?, after?, fields })` → stores only `fields` that changed, drops any field named in `AUDIT_DENY` (`password`, `tokenVersion`, `documents`, `receipt`) even if listed; `pageList(query, { page, limit }) => { items, meta }`; chat: `ensureKaluppaChat(userId)` (members: user + virtual `team:kaluppa`), `ensureGroupChat(associationId)`, `joinGroup(userId, associationId)`, `endMembership(userId, conversationIds)` (`canPost:false`, `leftAt`), `endDirectChatsBetween(userId, otherUserIds)`.

- [ ] Tests: audit stores changed allow-listed fields with before/after, never `password`/`documents`; `system` actor; pageList returns `{page:2, limit:10, total:23}` and 10 items; `ensureKaluppaChat` twice → one conversation; `endMembership` keeps the row with `canPost:false`; `farmer_document` signs image and pdf, a 10 MB + 1 pdf is refused by the server re-check; `video` kind refused for every purpose except `post_media`.

### Task 8.3: Associations and Group Managers

**Files:** `models/association.model.js`, `services/{association,groupManager}.service.js`, repositories, schemas, routes, controllers, `templates/email/accountInvite.template.js`; tests `tests/associations.test.js`, `tests/groupManagers.test.js`.

**Interfaces:** endpoints of PHASE-2-SPEC §5 (Associations and Group Managers, `GET /associations/options`). Invite = reset-password token (60 min) emailed as "set your password".

- [ ] Tests: create association → group chat created; name unique → 409 `errors.name`; archive refused with farmers or a Group Manager (409, message names which), allowed when empty → group chat read-only; create Group Manager requires email, sends invite, creates their Kaluppa chat, joins the association's group chat when assigned; one Group Manager per association (409); move → old group chat and their direct chats with old farmers read-only, joins new; archive → `status:'suspended'`, `tokenVersion++`, open session 401, association's `groupManager:null`; every mutation writes an audit entry; non-Kaluppa → 403.

### Task 8.4: Farmer profile, requests, decisions, Group Manager-created farmers

**Files:** `models/farmerProfile.model.js`, `services/{farmerProfile,farmer}.service.js`, repositories, schemas, routes, controllers, templates `farmerRequest`, `farmerDecision`, `transferDecision`; notification types from PHASE-2-SPEC §4; tests `tests/farmerProfile.test.js`, `tests/farmers.test.js`.

**Interfaces:** PHASE-2-SPEC §5 Account and Farmers endpoints. Every farmer account gets a `FarmerProfile` at creation (signup, Group Manager, seeder; status `none`, or `approved` for Group Manager-created) — M10's cap lock relies on it. Decisions use a conditional update on `status:'pending'` (or `transferRequest` present). `POST /farmers` → `{ farmer, temporaryPassword? }` (12 chars, shown once, never stored in plain text or audit).

- [ ] Tests: request needs association + both documents (image or pdf, own folder); a second request while pending → 409; request to an association without a Group Manager notifies Kaluppa; approve → `approved`, joins group chat, email + notification; reject needs a reason (5–300), farmer sees it and can resubmit; double approve → one 200, one 409 (Review Focus 5); Group Manager of another association → 404 (Review Focus 1); transfer: stays in old association until approved; approval moves association, keeps `approved`, ends old group membership and direct chats with old members, joins new group; withdraw clears it; remove → unaffiliated, `status:'none'`, chats with that Group Manager and the group read-only; Group Manager creates a farmer without email → username login works, `mustChangePassword`, approved + verified, `temporaryPassword` returned once; with email → invite queued, no password returned; every action audited without documents.

### Task 8.5: Shell, routes, badges, overview data

**Files:** `layouts/DashboardLayout.jsx`, `components/dashboard/{Sidebar,DashTopbar}.jsx`, `routes/AppRouter.jsx`, `routes/guards.jsx`, `pages/auth/SetPassword.jsx`, `pages/dashboard/overview/{OverviewFarmer,OverviewGM,OverviewKaluppa}.jsx`, `components/dashboard/{PageHeader,KpiTile,StageBar,CapMeter,BarChart}.jsx`; backend `services/dashboard.service.js` + `GET /dashboard/badges`, `GET /dashboard/overview`; tests `tests/dashboard.test.js`, `src/components/dashboard/BarChart.test.jsx`, `src/routes/guards.test.jsx`.

- [ ] Sidebar per role exactly as `Sidebar.dc.html` (sections, labels, icons, "Store" external icon, roast active fill, badges with `alert` roast fill, association card for farmer/Group Manager states approved/pending/none), hidden under 960 px with the top-bar menu button opening it as a focus-trapped drawer. DashTopbar: breadcrumb, cart (farmers), bell (Phase 1 dropdown), avatar menu per role. `/dashboard/*` routes from DESIGN §8.4 guarded by permission; delete `pages/dashboard/Overview.jsx` placeholder. `mustChangePassword` → `/set-password` before any route. Overviews per `OverviewFarmer` (status banners pending/rejected/none), `OverviewGM`, `OverviewKaluppa` with real tiles; charts without data yet show their empty state (q11).
- [ ] Tests: badges contain only permitted keys whose data exists so far (M8: Group Manager `farmers`; Kaluppa `orders` from Phase 1 pending orders; later milestones add `beans` M10, `reviews` M11, `inbox` M12), counts scoped by policy; overview tiles for each role from fixtures; `BarChart` legend only for 2+ series, "View as table" toggles a real `<table>`, tooltip on keyboard focus; guard sends a `mustChangePassword` user to `/set-password` and an unverified farmer to `/verify-email`.

### Task 8.6: DataTable, Drawer, ConfirmModal

**Files:** `components/dashboard/{DataTable,Drawer,ConfirmModal,StatusPill}.jsx`, `hooks/useTableParams.js`; tests alongside.

**Interfaces:** `<DataTable columns rows filters status actions onAction total page pageSize loading error emptyState searchPlaceholder minWidth />` where `status = { label:'Status', options }` renders first; `useTableParams(defaults) => { params, set, clear }` (URL-synced, `q` debounced 300 ms, `page` reset on filter change); `<Drawer open title eyebrow onClose footer width>`; `<ConfirmModal tone variant reasonRequired onConfirm>` (variants from `DashModals.dc.html`: archive, restore, reject, cancel sale, remove post, temporary password with Copy).

- [ ] Tests: filters and page round-trip through the URL; Clear filters resets all but `q`; cell kinds person / pill / two-line / mono; rows become cards under 640 px; empty, skeleton and error states; Drawer traps focus and closes on Esc; reason-required modal disables confirm below 5 characters; Copy writes the password to the clipboard.

### Task 8.7: Account pages

**Files:** `pages/dashboard/account/{Association,Profile,Security,Addresses}.jsx`, `components/dashboard/AssociationModal.jsx`, `pages/dashboard/{farmers/Farmers,groupManagers/GroupManagers,associations/Associations}.jsx` + drawers, hooks/services/schemas.

- [ ] Copy `AssociationModal` (variants new, rejected), `FarmerAssociation`, `Farmers` (+ `FarmerReview`, `FarmerForm` boards), `GroupManagers` (+ form), `Associations` (+ form). Status dropdown options = the screens' tab labels (q1). The window shows on sign-in per PHASE-2-SPEC §3.1; "Skip for now" closes it for the session.
- [ ] Component tests: the window's Send stays disabled until association + both documents; the temporary-password modal shows once and never again after close.

### Task 8.8: Seeds and Playwright

- [ ] Seeders: 3 associations, `manager.santacruz` (assigned), `manager.unassigned`, farmers `farmer.approved`, `farmer.pending`, `farmer.new`, `farmer.nomail`, a rejected one, one with a pending transfer, plus enough farmers for the Farmers page; Kaluppa chats and group chats; audit entries for seeded decisions.
- [ ] Playwright: farmer signs up → verify → window → send → pending banner; Group Manager approves in the review drawer → farmer's sidebar card says "Approved farmer"; Group Manager adds an email-less farmer → temporary password → that farmer signs in by username → set new password → overview; Kaluppa creates and archives a Group Manager; guard: Group Manager on `/dashboard/group-managers` → 403. Each page at 1440/390 per role.

---

## M9 — Records: farms, trees, harvests

### Task 9.1: Farms

**Files:** `models/farm.model.js` (partial unique `{owner, lotNumber}` where `archivedAt:null`, 2dsphere), `services/farm.service.js`, repository, schema (both sides), routes, controller; tests `tests/farms.test.js`.

**Interfaces:** PHASE-2-SPEC §5 Records (farms). `propertyNumber` = `TCT-<year>-<NNNN>` from Counter `farm:<year>`. Scope: farmer → own; Group Manager → its association's farms + Kaluppa farms it manages; Kaluppa → all (edits only `ownerType:'kaluppa'`). `PUT /farms/:id/assigned-farmers` only for `isAssignedManager`.

- [ ] Tests (one per scope rule): farmer lists only own; Group Manager lists association + managed Kaluppa farm, never another association's; Kaluppa lists all; Kaluppa PATCH on a farmer farm → 403; Group Manager create without `farmerId` → 400, with another association's farmer → 404 (Review Focus 1); lot number unique per owner (409), reusable after archive; pin required and inside Marinduque bounds; property numbers sequential per year; archive cascades to tree groups, keeps harvests; restore restores both; assigned farmers editable only by the managing Group Manager, only with its own approved farmers; audit on every mutation.

### Task 9.2: Tree groups and harvests

**Files:** `models/{treeGroup,harvest}.model.js`, services, repositories, schemas, routes, controllers; tests `tests/treeGroups.test.js`, `tests/harvests.test.js`.

- [ ] Tests: stages exactly the 5 keys; count 1–100 000; planted date not in the future; scope inherits the farm's (Group Manager may add on its managed Kaluppa farm, Kaluppa only on Kaluppa farms); harvest variety must be one the farm has an active tree group of → 400 `errors.variety`; yield 0.5 steps; `recordedBy` set from the actor; list filters farm / variety / stage / period; archive/restore; audit.

### Task 9.3: Shared MapPicker and record pages

**Files:** `components/map/MapPicker.jsx` (extracted from Phase 1 `AddressFormModal`, which then uses it), `pages/dashboard/records/{Farms,Trees,Harvests}.jsx` + drawers (`FarmForm`, `FarmView` with Details / Trees / Harvests tabs, `TreeForm`, `HarvestForm`).

- [ ] Copy `Farms` (role × start × tab), `Trees` (stage tiles), `Harvests` per role: columns, filters, titles and descriptions from each role branch; Group Manager forms show **Farmer** first; Kaluppa farm form shows "Managed by"; harvest variety disabled until a farm is picked. Phase 1 address map tests stay green after the extraction.
- [ ] Seeds: farms in all 6 towns incl. 2 Kaluppa farms (one managed by `manager.santacruz`), tree groups in all 5 stages, 12 months of harvests. Playwright per role at 1440/390; guard: farmer opening another farmer's farm URL → 404 page.

---

## M10 — Beans

### Task 10.1: Listings and the 5 kg cap

**Files:** `models/beanListing.model.js`, `services/bean.service.js`, repository, schema (both sides), routes, controller, `setting` key `branch` (q7) + order service reading it; tests `tests/beans.test.js`, `tests/beanCap.test.js`.

**Interfaces:** `listingNumber` `BN-YYMM-NNNN` (Manila); `GET /beans/cap → { capKg:5, usedKg, leftKg, approved }`; create runs in a Mongo transaction that bumps a per-farmer lock doc (`FarmerProfile.updateOne({user},{ $inc:{ capLock:1 } })`) before summing.

- [ ] Tests: unapproved farmer at 3 kg lists 2 kg ok, 2.5 → 403 `BEAN_CAP_EXCEEDED {capKg:5, usedKg:5, leftKg:0}`; two simultaneous 3 kg listings from 0 → one 201, one 403; cancelled/rejected/expired don't count; approved farmer has no limit and new listings get `countsTowardCap:false`; removal → new listings count again, old ones keep their flag (Review Focus 4); Group Manager lists for its farmer (cap is the farmer's), other association → 404; edit only while pending, re-checks the cap; photos 1–5 own `bean_photo` uploads; branch setting replaces `pickup.location` (pickup orders snapshot it; existing orders keep their copy).

### Task 10.2: Review flow, expiry job, notifications

**Files:** `services/bean.service.js` (review), `queues/jobs.queue.js`, `queues/workers/jobs.worker.js`, templates `beanStatus`, socket `bean:updated`; tests `tests/beanReview.test.js`, `tests/beanExpire.test.js`.

- [ ] Tests: approve sets `expiresAt` = approval + 7 days and emails branch address + hours + deadline; reject/cancel need reasons; approve vs reject at once → one 409 (Review Focus 5); complete keeps listed and final values; farmer cancels pending/approved, Kaluppa cancels approved only; `beans:expire` expires only approved past `expiresAt`, twice → no second change, audited as `system`; farmer + Group Manager in-app notifications, farmer email (skipped when email-less); `bean:updated` to farmer and Group Manager rooms.

### Task 10.3: Bean pages

- [ ] Copy `BeansFarmer` (role farmer/Group Manager × status unapproved/approved × start sell/view: steps strip, `CapMeter`, sell drawer with live total and over-cap state, view drawer banners per status with branch + hours) and `BeansKaluppa` (+ `BeansReview`: gallery in fixed frames, approve / reject → "Beans arrived" → final weight + amount → completed, cancel sale). Sidebar badge `beans`. Seeds: every status, one approved expiring in 1 day, `farmer.pending` at 3 of 5 kg. Playwright: over-cap Send disabled; full Kaluppa flow; per role 1440/390.

---

### M10 — done (2026-11-24)

- **Listings and the 5 kg cap**: `BN-YYMM-NNNN` listings (variety, form, weight in 0.5 kg steps, the farmer's price, 1–5 photos, note) by the farmer or their Group Manager (`farmerId`); association snapshot; pending, approved and completed kilograms of unapproved farmers count, checked in a transaction behind a per-farmer lock (403 `BEAN_CAP_EXCEEDED` with the meter); edit only while pending; scope by policy; every change audited.
- **Review flow**: Kaluppa approves (7 days to bring the beans), rejects with a reason, completes with the weight and amount from the branch (both values kept), or cancels a sale with a reason; the farmer side cancels while pending or approved; an hourly `beans:expire` BullMQ job expires approved listings; in-app, email (queued) and `bean:updated` socket events to the farmer and Group Manager. The `branch` setting (address, hours, phone) replaces `pickup.location`.
- **Dashboard**: Beans page per role (BeansFarmer / BeansKaluppa): the selling-limit meter and the four steps, sell/edit drawer (Send off above the cap, live total, photo uploads), view drawer (status banner, branch box, 16:10 gallery, history), Kaluppa tiles from list `meta.tiles`, review drawer, cancel modals, Status / Variety / Form filters, 404 for a listing outside your scope; `beans` sidebar badge; the farmer's overview cap meter and Kaluppa's to-review count are real.
- **Seeds**: `beans` seeder — 13 listings in every status, one approved listing expiring within a day, `farmer.pending` at 3 of 5 kg, photos from the seed media.
- **Verified**: backend 428/428, frontend 195/195, lint clean in both apps (and both suites green when run at the same time); `migrate:fresh -- --seed` ok; Playwright 49/49 (Phase 1 + M8 + M9 + `beans.spec.js`: over-cap Send off, approved banner with the branch hours and phone, the Group Manager's farmer limit, Kaluppa approve → complete / reject with a reason / cancel sale, buyer 403 guard, the Beans page per role at 1440/390); screenshots compared with BeansFarmer / BeansKaluppa; graphify updated (code only).
- **Not verified**: creating or editing a listing from the browser. The local Mongo is still standalone and these need transactions (a replica set). The API tests cover them on an in-memory replica set.
- **Waiting on later milestones**: the other overview bean tiles and charts (M14.2); Kaluppa's live refresh of the bean table (the `team:kaluppa` room, M12).

## Change 05 — react-icons, one Button, area highlights, username suggestions, farmer account pages

**Spec:** `docs/prompts/CHANGE-05-ICONS-BUTTONS-AREAS-USERNAMES-ACCOUNT.md`, CLAUDE.md "Icons and buttons", DESIGN §8.2 (Button, Icons, Area highlight, UsernameField, AccountNav), PHASE-2-SPEC §3.6b, §3.7, §5 Account. Runs after M10, before M11. One commit per part (`Change 05A: …` … `Change 05E: …`).

**Decisions (how, not whether):**
- **Icons**: `react-icons@5` (Lucide set `react-icons/lu`) replaces `lucide-react`. `components/ui/icons.js` exports app names only (`IconFarm = LuSprout`, …); components import from it, never from `react-icons/*` directly. Kept SVGs: `BeanMark` (logo), reaction badges, map pins. `Contours.jsx` / `AuthLayout` decor lines and `BarChart` / `Sidebar` / `DataTable` / `ConfirmModal` icon SVGs are redrawn with icons or CSS; charts draw with divs/SVG only where they are data marks (`BarChart` stays an allowed file if its `<svg>` is the chart itself — listed in the guard's allow-list).
- **Button**: rewrite `components/ui/Button.jsx` to the board (Buttons.dc.html): variants `solid` (#7B4A2A → hover #653B20), `outline` (#DCCBB5 border, white → #FBF8F4), `soft` (#F7EFE4 → #F1E2CF, ink #5A3218), `ghost` (transparent → #FBF6F0, roast), `danger` (#A1362B → #8A2C22), `danger-outline` (#E3B3AC border, white → #FDF0EE, #A1362B), `success` (#2E7D4F → #256B42), `link` (padding 0 2px, underline on hover), `light` (#F7EFE4 on dark, espresso), `glass` (white 10% bg, 35% border, white), `caramel` (#C8913A, espresso). Sizes `sm` 36/12px pad/13px, `md` 42/16/14, `lg` 48/20/15; `iconOnly` makes it square with 0 padding. Focus 2px roast ring offset 2, disabled 45 % opacity. New colours become `index.css` tokens. Old props map: `primary`→`solid`, `notice` stays as an extra variant (notice banners), `to`→`as={Link} to`, `pending`→`loading`. `loading` keeps width by stacking the label invisibly under the spinner+loading label in one grid cell.
- **Guard**: ESLint `no-restricted-syntax` on `JSXOpeningElement[name.name='button']` for `src/**` except `src/components/ui/**`.
- **Boundaries**: `faeldon/philippines-json-maps` v1.1.1 (**PSGC 2026-3q**, newer than the Dec 2023 named in the prompt; MIT, underlying data CC BY-IGO by NAMRIA and PSA via OCHA COD-AB — attribution in README and the map attribution control). Hi-res TopoJSON release (10 % vertices) decoded by `backend/scripts/build-boundaries.js` → municipalities ≈165 KB, barangays ≈290 KB, already ≤ 300 KB, so **no mapshaper pass** (coordinates rounded to 5 decimals). The script applies the alias map (`Isok II Pob.`→`Isok II Poblacion`, `Mataas Na Bayan`→`Mataas na Bayan`, `Pinggan`→`Pingan`, `Kinyaman`→`Kiñaman`, `Pag-Asa Pob.`→`Pag-asa Poblacion`, `* Pob.`→`* Poblacion`) so properties use our names `{psgc, municipality, barangay}`, and precomputes each feature's `label` `[lng,lat]` with **`polylabel`** (backend devDependency) — the client moves the pin there, no runtime polylabel or `/geo/search` call. The barangay geocoding fallback (`findBarangay`) is removed.
- **API**: `GET /locations/boundaries?level=municipality|barangay[&municipality=]` (public, `Cache-Control: public, max-age=604800`, Express's ETag). `services/boundary.service.js` loads the files once; `pointInPolygon` (ray casting, ~10 lines, no turf) for `/geo/reverse` and the outside-Marinduque check (point in any municipality = the island union).
- **MapPicker**: new props `municipality`, `barangay` (names); fetches boundaries via `useBoundaries(level, municipality)` (TanStack, `staleTime: Infinity`); `fill`+`line` layers per level filtered by name; `fitBounds` padding 40 (duration 0 under reduced motion); bottom-left label. A static `MapPreview` (read-only MapPicker) for address cards.
- **Usernames**: the existing Phase 1 endpoints are `/auth/username-availability` and `/auth/username-suggestions` (the spec's `/users/username-*` names point at these; reuse, don't add new). Extract `components/auth/UsernameField.jsx` from Register; add `except` (current user id) so an edit drawer doesn't see its own username as taken. Farmer and Group Manager create/update services map a duplicate key to `409 USERNAME_TAKEN` (`errors.username`).
- **Account pages**: `AccountNav` pill bar; `/dashboard/account/{profile,security,association,addresses}`; addresses reuse Phase 1 `/addresses` endpoints; `ADDRESS_LABELS` gains `Farm`, allowed only when the user has the `farmer` role (service check).

### Task C05.A: Icons
- [x] `npm i react-icons`, `npm rm lucide-react`; `icons.js`; replace every `lucide-react` import and inline icon `<svg>`; icon-only buttons get `aria-label`.
- [x] Check: `grep -rn "<svg" frontend/src` lists only BeanMark, reaction badges, map pins (and chart data marks); `grep -rn "lucide-react" frontend` empty. Lint + tests green. Commit `Change 05A`.

### Task C05.B: Button
- [x] Vitest `Button.test.jsx`: each variant and size renders its classes; `loading` → disabled, spinner, loading label; `as={Link}` renders an `<a href>`; `iconOnly` without `aria-label` → `console.error`/warn in dev.
- [x] Rewrite Button; replace every raw `<button>` and button-styled link outside `components/ui/`; table row icon actions `iconOnly ghost sm`; ESLint guard. Lint + tests green. Commit `Change 05B`.

### Task C05.C: Area highlights
- [x] Build script + data files; tests `boundaries.test.js`: every name in `marinduque-locations.json` matches exactly one feature (218 + 6); endpoint shapes and headers (`Cache-Control`, `ETag`, 304 on `If-None-Match`); unknown municipality → 400; `reverse` of a Pantayin point → Santa Cruz / Pantayin without Mapbox naming it; a point in the sea inside the old box → outside.
- [x] MapPicker highlight + fit + label + pin to `label`; used by AddressFormModal, FarmForm, FarmView, branch settings; Farm Map filter/selection when M14 builds it (only `FarmMap` in screens today — note in log). Playwright: pick Boac → highlight layer drawn, then Mainit. README attribution. Commit `Change 05C`.

### Task C05.D: Username suggestions
- [x] Backend tests: create farmer / Group Manager with a taken username → 409 `USERNAME_TAKEN`; update to another user's username → 409; availability with `except` → available for own name.
- [x] `UsernameField` in Register, FarmerForm, GroupManagerForm (add + edit); Save disabled while taken/invalid. Playwright: taken → suggestion → save. Commit `Change 05D`.

### Task C05.E: Farmer account pages
- [x] `AccountNav`; Association page in 4 states (FarmerAssociation.dc.html) incl. Withdraw request (confirm) → `DELETE` pending request; Addresses page (FarmerAddresses.dc.html) with map previews, distance/fee, Farm label; avatar menu link. Tests: Farm label for buyer → 400; withdraw request → status none. Playwright: 4 states with seed farmers, Addresses page at 1440/390. Commit `Change 05E`, update this log, stop.

### Change 05 — done (2026-11-25)

- **A, icons**: `react-icons` (Lucide) through `components/ui/icons.js` only (ESLint `no-restricted-imports`); `IconContext` makes icons `aria-hidden`. Inline SVGs left: BeanMark, `Contours` decor, reaction badges, map pins, BarChart's data marks (ESLint `no-restricted-syntax` guard on `<svg>` outside those). `IconShow` = `LuMessageSquareDot` (no "message square check" in the set).
- **B, Button**: one `<Button>` with the board's variants and sizes, `loading` that keeps its width, `as={Link}`, `iconOnly` warning; a guard forbids raw `<button>` outside `components/ui/`. Decision: clickables that aren't buttons on the board (menu rows, chips, tabs, thumbnails, map controls, steppers) use `variant="bare"` (reset only) rather than one primitive each.
- **C, areas**: PSGC 2026-3q polygons (6 + 218, our spellings, `label` + `bbox` per feature, ≤ 300 KB each, no mapshaper pass); `GET /locations/boundaries` (week cache, ETag); reverse geocoding and the Marinduque check by point-in-polygon (200 m shore tolerance), Mapbox only for the street; MapPicker highlights + fits + names the area; seeds pinned inside their barangays. **Not built yet**: Farm Map filter highlight (M14) and branch settings (M11) — they'll use the same MapPicker `focus`.
- **D, usernames**: `UsernameField` (sign-up's) in Register and the Add/Edit farmer and Group Manager drawers; suggestions follow the name; saving is blocked while taken or invalid; `409 USERNAME_TAKEN`. Decision: edit drawers treat the account's own username as fine on the client (`current`), so no `except` parameter was added to the availability endpoint.
- **E, farmer account**: pill AccountNav (Profile · Security, plus Association · Addresses for farmers); Association in 4 states. The profile API now returns history with names, the Group Manager's email, the association's farm count, the cap and the farmer's own totals. New endpoints: `DELETE /me/farmer-profile/request` (withdraw, with a confirm) and `PATCH /me/farmer-profile/documents` (Replace, audited by name only). A rejected farmer's "Send it again" resends with the documents on file. The farmer's own mutations return the full profile. Addresses page with still MapPicker previews (`preview` prop), distance/fee, and a striped "No pin yet" panel; the `Farm` label is allowed by `farms.manage` (permission, not role; a buyer gets 400). Seeds: Rodel (`farmer.approved`) has 3 addresses like the screen.
- **Deviations from the screens**:
  - Rejected: both document chips say "Replace this", because the reason is free text and doesn't say which document. The "Fix" stat reads "Your documents".
  - Group Manager card: no "Meets" row and no "replies within a day" line (no data). Phone shows "—" for the seed Group Managers, who have no number.
  - Approved timeline: "Reviewed by" and "Approved" share the decision date.
- **Verified**: backend 441, frontend 219 (+ `Association.test.jsx`), lint clean in both apps; `migrate:fresh -- --seed` ok. Playwright: `maps.spec.js` (Boac → Mainit in the address window at 1440/390 and the farm form, camera fit, boundaries cache), `dashboard.spec.js` (taken username → suggestion → save), `farmerAccount.spec.js` (Association for approved / pending / rejected / none at 1440/390, the Addresses page through the avatar menu at 1440/390, the buyer guard for the Farm label). Screenshots compared by hand with FarmerAssociation / FarmerAddresses / AddressModal. Full suite after the reseed: 58/60. The two failures (a11y guest pages, beans page-fit) passed on rerun; they were caused by network timeouts to Atlas and Valkey during the run. The beans spec's "3 of 5 kg" check only holds right after a reseed, because the spec changes `farmer.pending`'s listings. Found and fixed during verification: two leftover `pending=` props on `<Button>` from 05B (ConfirmModal confirm, product Add to cart), which had dropped their spinners.
- **Risk**: every pinned address card is its own Mapbox map (WebGL context); 10 addresses = 10 maps on one page (Chrome allows ~16).

---

## M11 — Store for farmers, Kaluppa orders, inventory, reviews, settings

### Task 11.1: Farmers in the store and farmer orders

- [ ] Storefront guards let farmers into `/products`, `/products/:slug`, cart, `/checkout` (categories by permission: Fertilizer + Seedlings); order placed by a farmer redirects to `/dashboard/orders?open=<id>`; farmer addresses at `/dashboard/account/addresses`. Copy `OrdersFarmer` (table, view drawer with timeline, cancel modal with reason `SearchSelect`). Tests: farmer sees no Coffee and can't add it (403); buyer still sees only Coffee; farmer orders list via Phase 1 endpoints.

### Task 11.2: Kaluppa orders

**Interfaces:** `GET /admin/orders?status=<group>&type=buyer|farmer&method&payment&q&page` (groups as Phase 1: to_confirm, preparing, on_the_way, completed, closed, all); manage actions call Phase 1 `orderStatus.transition` / `markRefunded` (no duplicate logic).

- [ ] Copy `OrdersKaluppa` + `OrderManage`: Confirm disabled until "The receipt matches the total" for e-wallet; next-step button follows status; rider fields; COD "Cash collected"; refund reference. Tests: filters by customer type; non-Kaluppa → 403; transitions still pass the Phase 1 suite.

### Task 11.3: Inventory

**Interfaces:** `/admin/products` CRUD + archive/restore; `photos[] {url, publicId, isThumbnail}` ≤ 5 with exactly one thumbnail (first by default; deleting it promotes the first remaining); unit adds `sack`; `featured` coffee only; low stock < 10 (< 50 seedlings).

- [ ] Tests: thumbnail invariant on create, pick, delete; featured on fertilizer → 400; cards/cart/order snapshot use the thumbnail; archive hides from the store; audit. Copy `Inventory` + `InventoryForm` (category-dependent fields, thumbnail pick with "★ Thumbnail").

### Task 11.4: Review moderation

- [ ] Endpoints of PHASE-2-SPEC §5 Reviews; rating recount from visible reviews only; public list excludes hidden and includes `reply`; reviewer notified on reply and hide. Copy `Reviews` + `ReviewView`; "Reply from Kaluppa" box on `ProductDetail`. Tests: hide → rating recomputed without it; one reply per review (PUT upserts); reviewer can't see the moderation endpoints; badge `reviews` counts "needs reply".

### Task 11.5: Settings

- [ ] `GET/PATCH /admin/settings/branch|delivery|ewallet`; branch drives quote origin, pickup card and bean instructions; `wallet_qr` upload. Copy `SettingsKaluppa` (tabs, weekday hour switches, "Try it" fee calculator, sticky save bar on change, branch `MapPicker`). Tests: new branch pin changes the next quote, not saved orders; hours validation (from < to); audit.
- [ ] Playwright: farmer buys fertilizer → lands on its order drawer; Kaluppa confirms (receipt gate) → out for delivery → sold; inventory thumbnail pick; review reply visible on the product page; per role 1440/390.

---

## M12 — Inbox

### Task 12.1: Messages and rules

**Files:** `models/message.model.js`, `services/inbox.service.js`, repositories, schemas, routes, controllers; tests `tests/inbox.test.js`.

**Interfaces:** PHASE-2-SPEC §5 Inbox endpoints; `canMessage(user, other) => boolean` (matrix §3.9); direct `pairKey` = sorted ids; messages `?before&limit=30`; delivered/read move the member cursors; unread = messages after `lastReadAt` not sent by the member.

- [ ] Tests: the full who-can-message matrix (farmer, unaffiliated farmer, Group Manager, Kaluppa) and `/inbox/people` returns only allowed people; second `POST /conversations/direct` → same conversation; send to a read-only membership → 403; edit at 14:59 ok, 15:01 → 403; delete for everyone keeps a tombstone; delete for me hides for that user only; cursor paging of 75 messages; delivered/seen derived from cursors ("Seen by N" in groups); `team:kaluppa` replies show the Kaluppa sender's name; attachments follow the upload rules.

### Task 12.2: Realtime

- [ ] Rooms `conversation:<id>` and `team:kaluppa` joined at handshake from memberships; events `message:new|updated|deleted`, `conversation:read|delivered|updated`, `typing` (client throttle 3 s, server expiry 5 s); membership end emits `conversation:updated` (Review Focus 4). Tests: a non-member never receives a conversation's events; typing relays only to other members.

### Task 12.3: Inbox UI

- [ ] Copy `Inbox` (each `conv`: group, Kaluppa team, direct, read-only) and `InboxMobile` (list → chat with back): filters All / Unread / Groups, search, reply quote, edit mode, delete menu, typing dots, "Loading earlier messages", status line, read-only note, sidebar badge `inbox`. Seeds: every kind with sent/delivered/seen, one edited, one deleted for everyone, one read-only. Playwright with two contexts: message, typing and seen update live; 1440 and 390.

---

## Change 06 — Phone layouts, overview date filter, History in drawers, fidelity fixes, GCash only

**Prompt:** `docs/prompts/CHANGE-06-MOBILE-DATES-HISTORY-INBOX-GCASH.md`. Specs: DESIGN §8.2 / §8.5 / §8.6, PHASE-2-SPEC §3.14–§3.16. Runs after M12 (it was written for before M12, so Part E rebuilds the M12 Inbox to the revised screens). One commit per part: `Change 06A: …` … `Change 06F: …`.

### Task C06.A: Phone and tablet (DESIGN §8.6)
- [x] Nav drawer: 280px (max 86%), close button inside, closes on navigate/Esc/backdrop (Modal already traps focus). Avatar name/role hidden < 960px (already).
- [x] `DataTable` < 720px: toolbar stacks (full-width search; filters a 2-column grid; "Clear filters" spans the row); rows render as a `<ul>` of cards (first column = title with avatar for person cells; others as `<dl>` label/value rows, values right; pills kept; actions as labeled 38px buttons); footer stacks with centered pages. The table never scrolls sideways on a phone.
- [x] `PageHeader` < 720px: actions full width and stretched. `Drawer` < 720px: full width, body 20/18, head/foot 18px sides, footer buttons stretch; every 2-/3-column field grid one column (shared `kk-g2`/`kk-g3` → Tailwind `max-[720px]:grid-cols-1` on the grids). `Modal` center: `calc(100% - 32px)`.
- [x] Maps keep aspect ratio (`aspect-*` + `max-w-full`).
- [x] Playwright `mobile.spec.js`: every dashboard route per role at 390 and 768: `scrollWidth <= innerWidth`, open the first drawer when the page has one.

### Task C06.B: Overview date filter, fully live overviews (PHASE-2-SPEC §3.14)
- [x] Backend `utils/period.js`: `periodRange(period, now)` → `{ from, to, prevFrom, prevTo, buckets: [{ from, to, label }], label, rangeText, prevLabel }` in Asia/Manila; Monday weeks; today = 6 two-hour buckets from 6 AM (earlier → first, later → last); month = weeks (Week 1 = days 1–7 …); year = Jan–Dec.
- [x] `GET /dashboard/overview?period=today|week|month|year` (Zod, default `month`). Per role: period KPIs (harvest kg, beans kg, sales ₱, with `{ previous, pct }` comparison and `vs <prevLabel>`), stock KPIs as of now (farms, trees, orders to confirm, listings to review, farmers), charts bucketed (harvest by variety for Group Managers, single series otherwise), tree stages, beans / orders / queue / low-stock lists from real data.
- [x] Frontend `DateRangeSegmented` (pill bar, 36px segments, espresso active), "Showing this month · Nov 1 – Nov 30, 2026"; `?period=` synced, remembered in `localStorage` per user (try/catch).
- [x] Tests: boundaries (Manila midnight, Monday week start on a Sunday, month/year edges), previous period, comparison maths (0 → null), scope per role.

### Task C06.C: History in drawers (PHASE-2-SPEC §3.15)
- [x] `GET /audit-logs/entity/:entityType/:entityId?cursor&limit=5` → newest first, cursor paged; access = can view the record (resolved per entity type through the existing service getters, which already apply the policy), else 404. Kaluppa gets `canOpenAuditLog`.
- [x] Audit gaps filled: order status changes (staff, buyer cancel, system expiry), receipt check (`payment.verifiedAt`), rider, refund; farmer's own contact change.
- [x] `<History entityType entityId />` at the end of the listed drawers; Farm view gets a History tab; order timeline titled "Status".
- [x] Tests: entity history scope (owner, another farmer → 404, Kaluppa), cursor paging, order transitions write entries.

### Task C06.D: Inventory thumbnail star
- [x] 26px round star button top-left (outline roast on white 92% / filled white on roast), `aria-pressed`, labels; no text badge; tiles never overflow (5 per row at 620px, 3 per row on phones).

### Task C06.E: Settings and Inbox match their screens
- [x] Settings: values in the prompt; spacings changed listed below when done.
  - Measured with Playwright at 1440 and 390 against `SettingsKaluppa.dc.html`'s source CSS (the screen's template doesn't render outside Claude Design, so its numbers are read from the markup). Already matching: `main` 28/32 (20/16 under 960px), 20 gap; tabs 44px, 14px sides, 14px text, 600 + 2px roast underline when active; cards `flex: 1 1 420px`, gap 16, padding 22, 14 between fields, title 16/600, helper 12.5px; inputs 44px; 2-column grids gap 20; hours list 6px row gap; map 600:440 radius 8; fee result box 14px on crema; wallet cards grid gap 16, padding 22, QR column 160px; save bar 14/18, radius 8, top shadow.
  - Changed: hour switches 38×22 → **40×22** (knob 16px, on at 21px); "Try it" label margin 14 → **12**, its input 8px below → **6px**, 44px tall → **42px** (9/12 padding). The E-wallet note box (12/14 padding) and the provider status badge come with Part F, since their text depends on the enabled providers.
- [x] Inbox measured the same way at 1440/390: panel 760/radius 10, list 340, search 40px/radius 5/white/34px icon padding/13.5px, rows 11/14, messages 16/20 gap 12, composer textarea radius 5 min 42, send 42×42 radius 5. Changed: search (was a cream pill, 13px), composer textarea (was radius 21) and send (was round); photos on chat rows, thread header, group authors and Seen-by chips (`avatarUrl` from the API; Liza, Nestor and Lorna seeded with photos); the "…" menu now opens directly below its button, right-aligned (left-aligned when that would cross the thread's edge on a phone), flips up only without room below, keeps the hover actions visible, and the "…" shows a pressed background.
- [x] Inbox: panel 760px/radius 10, list 340px, list header, 5px-corner search and composer, chips, rows, thread header, bubbles, composer, avatars with photos everywhere (seed a few avatars), "…" menu directly below its button, flips up only without room, pressed state while open.

### Task C06.F: Copy and payments
- [x] Landing: remove the "How ordering works" note. Payment copy from the enabled providers (`paymentPhrase(providers)`): hero (`{payments}` token in seeded slides), step 3, FAQ, product notes, cart drawer, checkout (tabs hidden with one provider), Settings note. Emails already use the order's provider.
- [x] Providers: `showAtCheckout` replaces `enabled` (old values read through); seed GCash on, Maya saved but off. Public `GET /delivery/info` carries `payment.providers`.
- [x] Test: turning Maya on makes it appear in the copy with no code change.
  - Done as: `lib/payments.js` (`orList`, `paymentPhrase`, `fillPayments`) + `usePaymentProviders()` reading `/delivery/info`; Settings → E-wallet note and "Shown / Hidden at checkout" badges built from the saved accounts. Seeded orders use GCash only, so Maya appears nowhere while it's off. Tests: backend (`adminSettings.test.js`) turns Maya on and sees it in `/delivery/info` and `/settings/payment`; frontend phrase and note tests.

---

## M13 — Hub and the landing top 3

### Task 13.1: Hub API

- [x] `/hub/posts` per PHASE-2-SPEC §5: tags ≤ 3 from the list, media ≤ 10 (`post_media`: image 5 MB, video 50 MB), author edit/delete, Kaluppa remove with reason (`posts.moderate`), comments/replies/reactions on Phase 1 endpoints now open to `posts.comment`/`posts.react`. Notifications per §6. Tests: Group Manager can't remove others' posts; buyers still can't react or comment; a removed post disappears from the feed and its author is notified.

### Task 13.2: Views and top 3

- [x] `POST /hub/posts/:id/view` (signed-in, unique `{post,user,day}`), `posts:top3` hourly job (last 30 days) cached in Valkey `posts:top3`, `GET /posts/top`; landing section "Most viewed this month" (`Main.dc.html`) replaces latest posts; the public post page serves only the top 3 to guests/buyers, others ask to sign in. Tests: guest views not counted; same user twice a day = 1; job ranks correctly and is idempotent.

### Task 13.3: Hub UI

- [x] Copy `Hub` per role: composer expands on focus, tag chips (max 3, others disabled), tag filter chips, cursor feed, fixed 16:10 grid (1 / 2 / 1+2 / 2×2 "+N"), viewer (contain), reaction picker, comments with replies, post menu (author Edit/Delete; Kaluppa Remove with reason). Playwright: portrait photo never changes a card's height (grid and viewer) at 1440/390.

---

## M14 — Farm Map, overviews, reports, audit log

### Task 14.1: Farm Map

- [x] `GET /map/farms` scoped by role with popover fields (§3.11); copy `FarmMap` per role (filters, side list fly-to, Kaluppa farms darker, "Open farm" → farm view drawer). Tests: scope per role; variety filter.

### Task 14.2: Overviews and reports

- [x] Finish every overview tile and chart; `/reports/*` with `$facet` aggregates, period and association filters (Group Manager forced to its own), `/reports/export.csv?section=` + Export all (`utils/csv.js`, escapes `"`, `,`, newlines, leading `=+-@`). Copy `Reports` per role. Tests: totals match fixtures; Group Manager can't read another association; CSV escaping and formula-injection guard.

### Task 14.3: Audit log

- [x] `/audit-logs` list/detail/CSV with filters (area, role, period, search); copy `AuditLog` (diff drawer). Coverage test: run each Phase 2 mutation once and assert one audit entry per call with no denied fields.

---

## M15 — Seeds, polish, verification

- [x] Complete PHASE-2-SPEC §8 coverage and the sign-in table (every handle in §8 plus Phase 1's).
- [x] Playwright per role (farmer, Group Manager, Kaluppa) through every sidebar item at 1440/390, compared with each screen's Tweaks branches; fix differences.
- [x] Accessibility (drawer/modal focus traps, keyboard tables and filters, chart table views, axe), performance (lazy dashboard routes, image sizes), README (roles, handles, jobs).
- [x] PHASE-2-PROMPT §4 checklist all green.

---

## Milestone summaries

(Added after each milestone.)

### M8 — done (2026-11-23)

- **Permissions and policies**: Phase 2 permission slugs and role matrix; policy helpers (`isOwner`, `isAssociationManager`, `isAssignedManager`, `isKaluppaFarm`, `seesEveryAssociation`); farmers must verify their email (`verified` middleware); Group Manager-created farmers sign in by username and set a new password at `/set-password` (`mustChangePassword`, `POST /auth/first-password`).
- **Platform pieces**: `audit.record` with allow-listed fields; chat memberships (Kaluppa chat per farmer/Group Manager, association group chat; `pairKey` upserts); page-numbered lists for management tables; upload purposes incl. `farmer_document` (images and PDF).
- **Associations and Group Managers**: CRUD, archive/restore (refused while farmers are approved or waiting), one Group Manager per association, archived Group Manager sessions revoked.
- **Farmers**: profile states none → pending → approved/rejected, transfers, removal with reason, Group Manager-added farmers (temporary password shown once when there's no email); exactly one decision wins (conditional update → 409); every step audited and notified (no email to email-less farmers).
- **Dashboard**: shell (role-keyed sidebar, top bar, badges, sidebar association card), overviews for farmer / Group Manager / Kaluppa, `DataTable` + `Drawer` + `ConfirmModal`, Farmers / Group Managers / Associations pages, Account settings tabs (Profile, Security, Association, Addresses for farmers), the "Join your association" window.
- **Seeds**: `associations` seeder — 3 associations (Santa Cruz, Boac, Gasan without a Group Manager), `manager.boac`, farmers in every state (`farmer.pending`, `farmer.new`, `farmer.nomail`, `farmer.rejected`, `farmer.transfer` + 10 more); `manager.santacruz` starts with 4 waiting.
- **Verified**: backend 311/311, frontend 122/122, lint clean in both apps; `migrate:fresh -- --seed` ok; Playwright 33/33 (Phase 1 + `dashboard.spec.js`: sign-up → verify → join → approve, email-less farmer → set password, Kaluppa archives a Group Manager, Group Manager 403 guard, every M8 page per role at 1440/390); screens compared by hand at 1440/390 in 8.5–8.7; graphify updated (code only — the 79 docs were not re-extracted).
- **Waiting on later milestones**: farm and harvest columns/tiles (M9), `farmer.pending`'s 3 of 5 kg (M10), storefront for farmers (M11), Inbox/Hub/Farm Map pages and seeds (M12–M13); their sidebar entries show a Coming soon page.

### M9 — done (2026-11-23)

- **Farms**: model with `TCT-<year>-<NNNN>` property numbers, lot numbers unique per owner among active farms, Mapbox pin; scope by policy (farmer → own; Group Manager → its association's farmer farms + the Kaluppa farm it manages, acting for a farmer with `farmerId`; Kaluppa → all, edits only Kaluppa farms); "Managed by" and assigned farmers on Kaluppa farms; archive/restore; farm records follow the farmer on approve / transfer / removal and follow a Group Manager who moves.
- **Tree groups and harvests**: five stages, count 1–100,000, yield in 0.5 kg steps, dates not in the future (Manila); a harvest's variety must have active trees on its farm; scope follows the farm; archiving a farm archives its tree groups and restoring it brings back only those (harvests stay); list meta carries the page tiles; every change audited.
- **Dashboard**: Farms (add/edit drawer with the map, view drawer with Details / Trees with inline add and edit / Harvests, assigned farmers, 404 page for a farm link outside your scope), Trees (stage tiles), Harvests (summary tiles, Period filter); `MapPicker` gained a pin label, optional search and a read-only mode.
- **Seeds**: `records` seeder — 11 farms across all 6 towns (Kaluppa Demo Farm managed by `manager.santacruz` with 3 workers, Torrijos Nursery unassigned, one archived farm), 22 tree groups in all 5 stages, 96 monthly harvests over the last year.
- **Verified**: backend 367/367, frontend 152/152, lint clean in both apps; `migrate:fresh -- --seed` ok; Playwright 40/40 (Phase 1 + M8 + `records.spec.js`: farmer adds a farm → trees → harvest, Group Manager and Kaluppa forms, 404 guard, every record page per role at 1440/390); screenshots compared with Farms / Trees / Harvests; graphify updated (code only).
- **Not verified**: the map tiles in the view and form drawers (the headless screenshots show the map frame before tiles draw).
- **Waiting on later milestones**: the Farmers page's farm and harvest columns still show "—" (they need per-farmer totals); overview record tiles stay as M8 built them.

### M12 — done (2026-11-26)

- **Messages and rules**: `Message` model (body, up to 5 image/PDF attachments, reply, edit within 15 minutes, delete for everyone / for me); who may message whom (`canMessage`); Kaluppa has no direct chats, since its chats are the per-person team chat; former members keep read-only history up to the time they left; receipts (Sent / Delivered / Seen, plus "Seen by N" in groups) come from member cursors; unread is a stored counter, and the sidebar badge counts chats with unread messages.
- **Realtime**: conversation rooms plus `team:kaluppa`; `message:new|updated|deleted` and `conversation:read|delivered|updated` carry ids only; typing is throttled to 3 s and expires after 5 s; membership changes join or leave rooms live.
- **Inbox UI**: two panes from 961 px; on a phone, the chat list, then the chat full screen with Back. Filters (All / Unread / Groups) and search; older messages load as you scroll up; day separators; reply quotes, a ⋯ menu (Edit / Delete for everyone / Delete for me), a composer (Enter sends, Shift+Enter adds a line, attach), typing dots, a read-only note, and New message (people search). The "Message" buttons open `?to=<userId>`.
- **Seeds**: `inbox` seeder with 18 messages in 7 chats around `farmer.approved`, covering every receipt state, an edited message, one deleted for everyone, photos and a read-only group.
- **Verified**:
  - backend 520/520 and frontend 258/258, lint clean in both apps;
  - `migrate:fresh -- --seed` ok;
  - Playwright 68/68 (Phase 1 + M8–M11 + `inbox.spec.js`: two farmers live — typing, message, Seen — the 390 px list → chat → Back, and the buyer 403 guard);
  - screenshots for farmer, Group Manager and Kaluppa at 1440/390, compared with Inbox / InboxMobile.
- **Not built** (see the ledger rulings): presence ("Active now"), the Chat details (i) panel, and an attachment preview tray.

### M13 — done (2026-11-27)

- **Hub API**: `/hub/posts` feed (tag filter, cursor), create / edit / delete by the author, Kaluppa's Remove with a reason (`posts.moderate`, the author is notified); comments with one level of replies, author edit/delete, Kaluppa's Remove for comments too; reactions on posts and comments (`posts.react` / `posts.comment`, buyers 403). `post_activity` and `post_removed` notifications link to `/dashboard/hub/posts/:id`. Post create/update/delete/remove and comment removal are audited. Media come from the author's own `post_media` folder and are re-checked on Cloudinary (video 50 MB, poster from the first frame).
- **Views and the top 3**: `PostView {post, user, day}` (Manila day, signed-in and verified only), `posts:top3` hourly job ranking the last 30 days into Valkey (`posts:top3`, re-ranked at once when a listed post is deleted or removed), `GET /posts/top` replaces `/posts/latest`. Guests and buyers open only those 3 (`/posts/:id` answers 403 otherwise); Hub members opening `/posts/:id` are sent to the dashboard post page.
- **UI**: `Hub` page (composer that expands on focus, tag chips max 3, Photo/Video uploads with a tray, URL-synced tag filter, infinite feed, fixed 16:10 `MediaGrid` 1 / 2 / 1+2 / 2×2 "+N", viewer modal with `contain`, reaction picker, comments with replies and Like, the ⋯ menu per role, success banner, aside with Most viewed this month and tag counts); `/dashboard/hub/posts/:id`; landing "Most viewed this month" (Main.dc.html); the public post page asks guests to sign in for any other post.
- **Seeds**: 10 tagged posts (Kaluppa, Liza, Rodel, Nestor, Lorna) with the portrait photos and a video, 247 views; the top 3 is Kaluppa / Liza / Nestor as in the screens.
- **Verified**:
  - backend 559 tests (`hub.test.js`: tags/media rules, buyers can't react or comment, Group Manager can't remove, removal notifies and leaves the feed, edit/delete own only, reactions switch without double counting, comment counts, views once a day, top 3 ranks, is idempotent and drops a removed post) and frontend 272 tests, lint clean in both apps (two existing tests, `inboxRealtime` and the Farmers temporary-password test, fail only under the full parallel run and pass alone);
  - `migrate:fresh -- --seed` ok;
  - Playwright 87/90: `hub.spec.js` 5/5 (post → react → comment → tag filter → Kaluppa removes → farmer notified; grid and viewer heights fixed at 1440/390; landing top 3 and the guest sign-in prompt; buyer 403). The 3 failures predate M13 and are stale after Change 06: `orders.spec` looks for a "GCash or Maya" radio (GCash only since 06F), `store.spec` reads an `<img>` inside the thumbnail button (a star button since 06D), `storefront.spec` review test finds no "Write a review" panel for `buyer`;
  - screenshots for farmer and Kaluppa at 1440 and Group Manager at 390, compared with Hub.dc.html by its markup values.
- **After review**: the Hub fills the page width (no 1240px page or 680px feed cap; the aside stays 340px on the right), like the Inbox; the aside (Most viewed + Tags) is sticky 28px from the top beside the feed, static on phones.
- **Not built**: the association name in a Group Manager's post meta ("· Santa Cruz Coffee Growers"); graphify not re-run.

### M14 — done (2026-11-27)

- **Farm Map**: `GET /map/farms` scoped like Farms (farmer: own; Group Manager: its association plus the Kaluppa farms it manages; Kaluppa: all), filters association (Kaluppa only), municipality and variety; popover with owner, association, size, trees, top two stages and last harvest. `FarmMap` reuses `MapPicker` (pins, selected pin, fly-to, popover; Kaluppa farms darker; Kaluppa marked on the map), side list flies to a farm, "Open farm" → `/dashboard/farms?open=<id>`.
- **Reports**: `/reports/:section` (summary, harvest, beans, sales, trees, breakdown) with `$facet` aggregates over Manila months, periods (last 12 months, this year, last year, last 30 days) and the association filter (Kaluppa only; a Group Manager is always its own association and its own farmers, without the Kaluppa farms it manages); store sales only with `orders.manage`. `/reports/export.csv?section=` and Export all (titled sections). Breakdown rows largest harvest first, then "No association" and "Kaluppa farms". Overviews were already live from Change 06B.
- **Audit log**: `GET /audit-logs` (area, role, from/to, entity, search; page-numbered), `/audit-logs/:id`, `/audit-logs/export.csv` (10,000 newest), `audit.view` only. `AuditLog` page: DataTable (When, Who, Area, What, Record, Changed; Area / Role / Period filters), diff drawer (Before struck through, After), `?entity=` from History's "Open in audit log". The Coming soon placeholder is gone.
- **Verified**:
  - backend 602/602 (`auditLog.test.js` runs 25 Phase 2 mutations once each and checks exactly one entry with no denied fields, plus list/detail/CSV/guards; `reports.test.js`, `farmMap.test.js`) and frontend 284/284, lint clean in both apps; backend vitest now runs 6 workers (12 timed out the shared replica set's hooks);
  - `migrate:fresh -- --seed` ok;
  - Playwright 94/97 on the full run; `insights.spec.js` 6/6 (Kaluppa filters the map by association → popover → Open farm; farmer sees own farms only; Reports Export all CSV; Group Manager's reports; audit entry diff; Group Manager / farmer guards) and the 390/768 pass now covers Farm Map, Reports and Audit log. Failures: `orders.spec` and `store.spec` (stale since Change 06, as in M13) and one inbox sign-in timeout that passes on rerun;
  - screenshots for Kaluppa, Group Manager and farmer at 1440/390, compared with FarmMap / Reports / AuditLog by their markup values. After review: Reports rows by harvest, Group Manager totals without Kaluppa farms, Insights crumb.
- **Not built**: report data before the seeded months (charts are sparse until M15 seeds); graphify ran code-only.

### M15 — done (2026-11-27)

- **Seeds** (PHASE-2-SPEC §8): audited the fresh seed against every bullet. The one gap was farmer store orders: `farmer.approved` now has 6 fertilizer/seedling orders (pending, processing, ready for pickup, cancelled, sold ×2) from the same builder as Juana's. The sign-in table lists every handle; `signins.spec.js` signs in as all 14 and checks where each lands.
- **Per-role pass**: `tour.spec.js` opens every sidebar item for farmer, Group Manager and Kaluppa at 1440 and 390 (fails on page errors, 5xx answers or a page without an h1; `SHOTS=<dir>` saves screenshots). Found: the Inbox had no h1 on phones (now screen-reader-only, as InboxMobile draws none). Screenshots reviewed for the overviews, orders, inventory, reports and phone views.
- **Accessibility**: axe on every dashboard page per role at both widths, plus a keyboard test of a view drawer (focus trapped, Esc closes, focus returns). Fixed: Mapbox markers holding buttons no longer `role="img"`; the Hub "+N" tile names its count; chat times and day separators at 4.5:1 (ink-4); the Reports table scroller is a focusable region.
- **Performance**: dashboard pages are lazy chunks; the entry bundle went from 688 kB to 396 kB (gzip 197 → 121 kB). Every image already goes through the Cloudinary resize helpers except signed document previews.
- **README**: roles, every seed handle and where it lands, what the seed covers, the four background jobs, GCash-only payment copy.
- **§4 checklist**: each item maps to tests (cap concurrency `beanCap`, transfer/removal `farmerProfile`, Group Manager without orders `permissions`, bean expiry `beanExpire`, Inbox `inbox`/`chat`, Hub `hub`, seeds `seed`, and the e2e specs).
- **Verified**:
  - lint clean; backend 602/602, frontend 284/284; `migrate:fresh -- --seed` ok;
  - Playwright: the full run was stopped by the machine running low on memory at 52/122, with 51 passed and Chromium crashing on the 52nd. Run alone this session and green: a11y 8/8, insights 7/7, tour 6/6, signins 14/14, orders + store 8/8 (the two specs stale since Change 06 now follow the current UI), inbox + auth. Not rerun after the M15 changes: maps, media, mobile, overview, payments, realtime, records, storefront, thumbnail (all green in the M14 full run).
- **Not built**: a reviewer subagent pass (self-review only); doc nodes in graphify not re-extracted.
