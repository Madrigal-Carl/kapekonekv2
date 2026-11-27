# KapeKonek — Phase 2 Build Prompt (dashboard: farmer, Group Manager, Kaluppa)

Phase 1 (guests and buyers) is built and Changes 01–04 are applied. Phase 2 builds the dashboard for **farmers**, **Group Managers** and **Kaluppa** on top of the existing app. Don't rewrite Phase 1; extend it.

## 0. Read first (do not skip)

1. `CLAUDE.md`, especially "Phase 2 rules".
2. `docs/PHASE-2-SPEC.md`: roles, permissions, flows, models, API, realtime, jobs, emails, validation, seeds. **It wins over PRODUCT-SPEC where they differ.**
3. `docs/PRODUCT-SPEC.md`: Phase 1 behavior that stays.
4. `docs/DESIGN.md` §8: dashboard shell, components, chart colors, screen → route map, interactions.
5. `docs/design/screens/*.dc.html`: **the approved UI. Match it exactly.** Each dashboard screen has a Tweaks prop (`role`, `status`, `start`, `tab`, `conv`); read every branch of `renderVals()` so you build all role variants and drawer states.
6. `_reference/` (AgriCentral) for patterns, and the user's original KapeKonek project if they added it under `_reference/original/` (its farm/tree/harvest/bean/audit code is a useful starting point; there's no DTI role here).

Everything is decided. If something is truly missing, write it in `docs/plans/phase-2-questions.md`, pick the most reasonable option, note your choice, and keep going.

## 1. Workflow
- Use **superpowers** to write `docs/plans/phase-2.md`: one section per milestone below, with tasks and the tests you'll write. Then execute milestone by milestone. **Stop after each milestone** so the user can check it and start the next one in a fresh session.
- Work on branch `phase-2`. Commit at the end of every milestone.
- After every milestone:
  1. `npm run lint` and `npm test` pass in both apps.
  2. `npm run migrate:fresh -- --seed` succeeds.
  3. Check each page the milestone touched with **playwright** against its screen at 1440px and 390px, **for each role that can open it**.
  4. Run `/graphify . --update`.
  5. Write the milestone summary in the plan.
- Use **ponytail** inside the layers, but keep the layered flow, guards, validation, modals and queues. Use **impeccable** and **taste** only to polish within the approved screens.

## 2. Milestones

### M8 — Dashboard shell, permissions, farmer onboarding, accounts
**Permissions and verification**
- Add the new permissions from PHASE-2-SPEC §2 and update the role seeder. Clear the `perm:user:*` cache.
- Add policy helpers (`isOwner`, `isAssociationManager`, `isAssignedManager`, `isKaluppaFarm`) with unit tests.
- Farmers must now verify their email (CLAUDE.md, Email verification rule).
- Add `mustChangePassword` with the first sign-in "Set a new password" page, styled like the auth pages.

**Shell**
- Dashboard layout from `Sidebar`/`DashTopbar`, with the role sections, badges and mobile drawer.
- `/dashboard/*` routes with `ProtectedRoute` checking permissions. Remove the Phase 1 placeholder.

**Shared UI pieces** (used by every later milestone)
- `DataTable`: search on the left, plain filter dropdowns on the right (the first one is Status; no tabs or count chips), all URL-synced; numbered pages, row actions, empty state, mobile cards.
- `Drawer` (roomy spacing per DESIGN §8.2) and `ConfirmModal`.
- `PageHeader`, `KpiTile`, `StatusPill`.

**Accounts**
- **FarmerProfile**: the association window, the pending/rejected banners, Account settings → Association (documents, transfer request/withdraw).
- **Group Manager Farmers page**: tabs; review drawer with approve/reject (reason); add farmer (optional email → invite, or temporary password modal shown once); edit; remove (modal).
- **Kaluppa pages**: Group Managers (create, assign association or "Assign later", move, archive/restore) and Associations (create with group chat stub, archive rules).
- **Notifications and emails** for requests and decisions. **Audit** entries for every action.

**Overviews**: the three Overview pages with real aggregates. A chart whose data comes in a later milestone shows an empty state until then.

### M9 — Records: farms, trees, harvests
- Shared `MapPicker`, extended from Phase 1's address map: municipality and barangay fly-to, ring, manual click/drag reverse-geocode, outside-island error.
- **Farm**: list, add/edit drawer with map, view drawer (Details / Trees / Harvests), archive/restore (cascades to tree groups), auto `propertyNumber`.
  - Kaluppa farms add "Managed by" and assigned farmers (only the assigned Group Manager edits that list).
- **Tree** page and the Trees tab: the 5 stages, counts, filters, the stage tiles.
- **Harvest** page: the variety is limited to the farm's tree groups; tiles; filters including period.
- Role scoping:
  - farmer: own records;
  - Group Manager: association records plus its Kaluppa farm, always with the **Farmer** field;
  - Kaluppa: edits its own farms and views everyone else's.
- Tests for every scope rule.

### M10 — Beans (sell to Kaluppa)
- `BeanListing` with all statuses and the **5 kg cap** in a transaction (concurrency test: two simultaneous 3 kg listings → one fails).
- Farmer / Group Manager page:
  - steps strip and cap meter;
  - sell drawer: photos (1–5), live total, cap error state;
  - view drawer: approved banner with **branch address and hours from Settings**, history, cancel.
- Kaluppa review queue:
  - review drawer with gallery (fixed frames);
  - approve / reject (reason) → "Beans arrived" → final weight and amount → completed;
  - cancel sale (reason).
- **`beans:expire` job** (hourly, idempotent) with notifications. Emails per PHASE-2-SPEC §6. Socket `bean:updated`.

### M11 — Store for farmers, Kaluppa orders, inventory, settings
_(Change 05 runs before this milestone: react-icons, `<Button>`, map area highlights, username suggestions, redesigned farmer Association and Addresses pages. Use them from here on.)_
- **Farmers in the store**: `/products` shows Fertilizer and Seedlings by permission; cart, addresses and checkout work for farmers. After placing an order, go to `/dashboard/orders?open=<id>`.
- **Farmer Orders page**: table, view drawer, cancel modal.
- **Kaluppa Orders**: table with tabs and filters; manage drawer (receipt check gate, confirm/reject, next steps, rider, cash collected, refund). Reuse the Phase 1 transition service; don't duplicate it.
- **Inventory**: product table, drawer (category-dependent fields, units including `sack`, photos ≤ 5 with **thumbnail selection**, featured coffee only, active), archive/restore, low-stock rules.
- **Reviews** (Kaluppa): table, review drawer, public reply (edit/delete), hide with reason / show again, ratings recount from visible reviews only, the "Reply from Kaluppa" box on the product page, notifications, audit.
- **Settings**: branch (map pin, hours), delivery fee (calculator), e-wallet (QR upload). The delivery quote, pickup card and bean instructions read from Settings. Orders keep their saved copy.

### M12 — Inbox
_(Change 06 runs before this milestone: phone layouts, the overview date filter, History in drawers, Inbox fidelity (5px inputs, avatars, menu below "…"), GCash-only copy. M12 builds on that Inbox spec.)_
- Conversation, ConversationMember and Message models, with the auto-created chats:
  - Kaluppa chats on account creation;
  - group chats per association;
  - direct chats on first message.
- Membership rules:
  - who can message whom;
  - read-only on transfer, removal or Group Manager move/archive;
  - the `team:kaluppa` shared inbox.
- REST plus sockets:
  - send, edit (≤ 15 min), delete for everyone / for me;
  - read and delivered cursors; typing (throttled);
  - older messages on scroll; unread counts and the sidebar badge;
  - attachments with the upload rules.
- UI: desktop two panes and phone list → chat exactly as `Inbox.dc.html` / `InboxMobile.dc.html`, including Seen by N, the reply quote, deleted bubbles, the typing dots and the read-only note.
- Tests: permissions matrix, cursor maths, edit window, delete for everyone.

### M13 — Hub and the landing top 3
- **Create post modal** (Facebook-style; also used for editing, with a discard check): text, ≤ 10 media (images 5 MB, **videos 50 MB**), ≤ 3 tags. Match `HubCreatePost` / `HubMobileCreate`.
- **Post viewer** (`HubPostView`, `HubPostText`, `HubMobileView`): caption, tags, reactions and the comment thread on the left; the media stage with prev / next and thumbnails on the right; deep link `/dashboard/hub/posts/:id?media=n`.
- Feed with tag chips and cursor loading; **fixed 16:10 media grid** (1 / 2 / 1+2 / 2×2 +N, cover) and the viewer (contain).
- Reactions (like / love / celebrate), comments with one level of replies, author edit/delete.
- Kaluppa **remove with reason**, with notifications.
- `PostView` (signed-in, once per day) and the **`posts:top3` job** (hourly, last 30 days, Valkey cache).
- Landing section "Most viewed this month" (`Main.dc.html`). The public post page only for those 3; anything else asks guests to sign in.

### M14 — Farm Map, overviews, reports, audit log
- **Farm Map**: pins scoped by role, popover (all fields), filters, side list fly-to.
- **Overviews**: finish every KPI and chart with real aggregates.
- **Reports**: charts (harvest by variety stacked, beans bought, store sales, trees by stage), the by-association / by-farmer table, period and association filters, **CSV export**.
  - Every chart has a legend or labels and the table view. Use the colors in DESIGN §8.3 exactly.
- **Audit log**: table, filters, diff drawer, CSV. Check that every Phase 2 service writes entries.

### M15 — Seeds, polish, verification
- Seeders for every Phase 2 collection (PHASE-2-SPEC §8): Gmail handles, `KapeKonek@123`, the `isSeed` mail guard, and every state covered (farmer states, bean statuses including one expiring in 1 day, chats of each kind with read states, portrait post photo, views for the top 3, audit entries).
- Print a sign-in table at the end of seeding.
- A Playwright pass for each role (farmer, Group Manager, Kaluppa) through every sidebar item, at 1440px and 390px. Fix differences from the screens.
- Accessibility (focus trap in drawers and modals, keyboard tables, chart table views), performance (lazy routes, image sizes), README updated.
- Final checklist (§4) all green.

## 3. Copying the design exactly
Follow Phase 1 §3. In addition:
- **Every role variant is a separate state** of the same component. Read the `role` branches in each screen's `renderVals()` (columns, filters, actions, form fields, copy), and build them through permissions and policies, not `if role ===`.
- Drawer states have their own boards (`FarmForm`, `FarmView`, `FarmerReview`, `BeansSell`, `BeansReview`, `OrderManage`). Match them.
- Charts: rebuild `BarChart` behavior (hover tooltip, legend for 2+ series, "View as table"). Don't add a second y-axis.

## 4. Final acceptance checklist
- [ ] Farmers must verify email. Group Manager-created farmers sign in by username and must set a new password when they have no email.
- [ ] Association window, banners, approve/reject with reason, resubmit, transfer (approval carries over, chats go read-only), removal (cap applies again) all work and are audited.
- [ ] Unapproved farmers can't list more than 5 kg in total (also under concurrency). Approved farmers have no limit.
- [ ] Bean flow: pending → approved (branch and hours in the email) → completed with final values; reject, cancel and **7-day expiry** work.
- [ ] Farms (auto property number, lot number, size, municipality, barangay, street, map pin with fly-to), trees (5 stages, inside the farm drawer and on the Tree page) and harvests (variety limited to the farm) work for each role's scope. Archive/restore works.
- [ ] A Group Manager can do everything for its farmers (with the Farmer field) but can't see their inbox or orders.
- [ ] Kaluppa: Group Managers, Associations, its own farms and harvests, the bean review, orders (buyers and farmers), inventory (thumbnail pick), review replies and hiding, settings (branch drives fees, pickup and bean instructions), reports with CSV, audit log.
- [ ] Inbox: allowed contacts only; sent / delivered / seen; typing; reply; edit ≤ 15 min; delete for everyone and for me; older messages load as you scroll; read-only chats; desktop two panes and phone list → chat.
- [ ] Hub: post / edit / delete, ≤ 3 tags with filter, reactions, comments and replies, Kaluppa removal with reason. **No media ever changes a card's height.** The landing page shows the top 3 most-viewed posts (signed-in views only, last 30 days).
- [ ] Farm Map pins and popovers by role. Overviews and reports use the validated colors, with a legend and table view.
- [ ] Seeds: Gmail handles, password `KapeKonek@123`, no mail to seed accounts unless `SEED_EMAIL_BASE` is set.
- [ ] Every dashboard page matches its screen at desktop and mobile for each role. Lint, tests and Playwright green; README updated.
