# KapeKonek — Phase 2 Spec (dashboard: farmer, Group Manager, Kaluppa)

Phase 1 (guests and buyers) is built. Phase 2 builds the dashboard for the three other roles on top of it. Everything in `docs/PRODUCT-SPEC.md` still holds unless this file changes it. These decisions are final unless the user changes them.

Screens: `docs/design/screens/*.dc.html` (the "Dashboard" rows of the canvas). The screen-to-route map is in `docs/DESIGN.md` §8.

---

## 1. Roles and how they work together

**Kaluppa** (super-admin, the only store seller, one seeded account for now)
- Creates **associations** and **Group Manager** accounts. It assigns a Group Manager to an association now or later.
- Owns farms. It assigns each Kaluppa farm to a Group Manager, who assigns farmers to work on it.
- Records trees and harvests on its own farms and can view every other record (read-only).
- Manages:
  - bean listings (review, approve, reject, complete, cancel);
  - all orders (buyers and farmers);
  - inventory, settings, reports and the audit log.
- Approves farmer requests for an association that has no Group Manager.

**Group Manager** (exactly one per association, and one association per Group Manager; only Kaluppa creates them)
- Approves or rejects farmers who ask to join the association, and creates farmer accounts. Farmers it creates are approved automatically.
- Records farms, trees, harvests and bean listings **for** its farmers. Every form gets an extra **Farmer** field.
- Assigns farmers to the Kaluppa farm it manages, and records trees and harvests on that farm.
- Has no access to farmers' inboxes or store orders. Its reports cover its association only.

**Farmer** (signs up, **must verify email** before the dashboard; this changes Phase 1)
- Sees the "Join your association" window on every sign-in until a request exists. While the request is pending, a banner shows instead. If it's rejected, the window comes back with the reason.
- Records farms, trees and harvests, and lists beans for Kaluppa. While unapproved, they can sell **5 kg** at most.
- Shops for Fertilizer and Seedlings like a buyer (cart, addresses, checkout, orders, reviews). A verified email is enough to shop.

**Two separate checks** (never mix the words):
- **Email verified**: needed for anything in the dashboard.
- **Approved farmer**: approved by a Group Manager (or Kaluppa). It removes the 5 kg cap. Removal from an association makes the farmer unaffiliated and unapproved again.

---

## 2. Permissions

| Permission | farmer | group_manager | kaluppa |
|---|:-:|:-:|:-:|
| `dashboard.view`, `inbox.use`, `posts.create`, `posts.react`, `posts.comment`, `map.view` | ✓ | ✓ | ✓ |
| `association.request` | ✓ | | |
| `farmers.manage`, `farmers.approve` | | ✓ (own association) | ✓ |
| `group_managers.manage`, `associations.manage` | | | ✓ |
| `farms.manage`, `trees.manage`, `harvests.manage` | ✓ (own) | ✓ (association + assigned Kaluppa farm) | ✓ (Kaluppa farms) |
| `records.view_all` | | | ✓ |
| `beans.sell` | ✓ (own) | ✓ (for its farmers) | |
| `beans.review` | | | ✓ |
| `catalog.farm_supplies`, `cart.manage`, `addresses.manage`, `orders.create`, `orders.view_own`, `orders.cancel_own`, `reviews.create`, `reviews.update_own`, `reviews.delete_own` | ✓ | | ✓ |
| `orders.manage`, `inventory.manage`, `reviews.moderate`, `settings.manage`, `posts.moderate`, `audit.view` | | | ✓ |
| `reports.view` | | ✓ (association) | ✓ (all) |

- Scope (whose record) is decided by **policy functions** in services, never by `role ===`:
  - `isOwner(user, record)`;
  - `isAssociationManager(user, record.association)`;
  - `isAssignedManager(user, farm)`;
  - `isKaluppaFarm(farm)`.
- `inbox.use` is new. Phase 1's "no order chat" rule still holds; the Inbox isn't tied to orders.
- Re-run the role seeder and clear `perm:user:*` after changing permissions.

---

## 3. Flows

### 3.1 Farmer sign-up and approval
1. **Sign up**: the same fields as a buyer plus a **required contact number**.
   - The farmer verifies their email, then lands on the dashboard.
   - Phase 1 farmers who never verified land on verify-email on their next sign-in. Seeded farmers are verified.
2. **Association window** (`AssociationModal.dc.html`):
   - It has an association search dropdown, a valid ID and proof of land ownership. The ID and the proof can each be an image (5 MB) or a PDF (10 MB).
   - All three are required to send. "Skip for now" closes it.
   - It shows on sign-in when the farmer has no association, no pending request and no rejected request. If rejected, it shows the reason.
3. **Pending**: a banner shows on the farmer overview, and the sidebar card says "Waiting for approval". The same form lives in **Account settings → Association** (`FarmerAssociation.dc.html`).
4. **The Group Manager reviews** the request in the review drawer (`FarmerReview.dc.html`):
   - **Approve**: the farmer becomes an approved farmer in the association, joins the group chat, and gets an email and a notification.
   - **Reject**: a reason is required. The farmer is emailed, sees the reason, and can resubmit (unlimited).
   - If the association has no Group Manager, the request goes to Kaluppa.
5. **Transfer**:
   - The farmer requests a new association, with an optional reason. The new Group Manager approves; until then the farmer stays in the old association.
   - On approval:
     - the farmer leaves the old group chat (read-only history);
     - their direct messages with old association members become read-only;
     - they join the new group chat;
     - **approval carries over**.
   - The farmer can withdraw the request.
6. **Removal by a Group Manager**: confirmation required. The farmer becomes unaffiliated and unapproved, so the cap applies again. Their records stay theirs, and their chats with that Group Manager and the group become read-only.

### 3.2 Farmers created by a Group Manager
- Email is **optional**. They sign in with a **username**.
- **Without an email**: the Group Manager sees a **temporary password once** (modal with Copy). The account has `mustChangePassword: true`, so the first sign-in goes to a "Set a new password" page.
- **With an email**: an invite link to set the password is sent instead.
- These accounts are approved and verified automatically. Documents are optional; they can be added later.

### 3.3 Group Manager accounts
- Kaluppa creates them with name, username, **email (required)**, contact number, and an association (or "Assign later"). An invite email sets the password.
- On creation, a direct chat with Kaluppa is created. When assigned to an association, the Group Manager joins its group chat.
- **Moved to another association**: the old group chat and their chats with old farmers become read-only, and they join the new group chat.
- **Archived**: they can't sign in. The association has no Group Manager, and Kaluppa handles its requests.

### 3.4 Associations
- Kaluppa creates them with a name, municipality, description and Group Manager (optional). A group chat is created with each association.
- An association can be archived only when it has **no farmers and no Group Manager**. Its group chat then becomes read-only.

### 3.5 Bean sale (farmer → Kaluppa)
The handover happens at the branch, outside the system.

| Status | Who / when | Notes |
|---|---|---|
| **pending** | Farmer lists (or a Group Manager lists for a farmer) | Variety, form (`fresh_cherry`, `dried_cherry`, `parchment`, `green_beans`), weight in kg (0.5 steps), **their own** price per kg, 1–5 photos (images, 5 MB), note. The farmer can edit or cancel. |
| **approved** | Kaluppa approves | Email + notification with the **branch address and hours** from Settings. `expiresAt` = approval + **7 days**. |
| **completed** | Kaluppa, after the beans arrive | Kaluppa may correct `finalWeightKg` and `finalAmountCentavos`; the listed and final values are both kept. |
| **rejected** | Kaluppa, from pending | Reason required. |
| **cancelled** | The farmer (pending/approved) or Kaluppa (approved) | Reason required when Kaluppa cancels. |
| **expired** | Job | Approved listings past `expiresAt`. A BullMQ repeatable job runs hourly and is idempotent. |

**The 5 kg cap** (unapproved farmers):
- The sum of `weightKg` over the farmer's listings with `countsTowardCap: true` and status in `pending | approved | completed` must be ≤ 5. `countsTowardCap` is set when a listing is created while the farmer is unapproved.
- It's checked in a **transaction** that locks per farmer: bump a counter document, as `_reference` does with `User.updateOne({$inc:{__v:1}})`.
- Error `403 BEAN_CAP_EXCEEDED {capKg:5, usedKg, leftKg}`.
- The UI shows the meter ("3 of 5 kg used") and blocks the form above the cap.

### 3.6 Farms, trees, harvests
- **Farm**:
  - `propertyNumber` is auto-generated (`TCT-<year>-<4-digit seq>`, using the Counter collection);
  - `lotNumber` is typed by the user, unique per owner;
  - `sizeHa`, municipality, barangay, optional street, and a **required pin**.
  - The form map follows the address-map rules (Phase 1 Change 03):
    - picking a municipality flies to it and moves the pin;
    - picking a barangay flies closer and moves the pin;
    - those moves never reverse-geocode or overwrite the fields;
    - a manual click or drag reverse-geocodes and fills the fields.
  - Kaluppa farms also have `managedBy` (a Group Manager) and `assignedFarmers[]`.
- **Tree group**: farm, variety, `count` (≥1), `stage`, `plantedAt`, `note`.
  - The stages are exactly 5: `newly_planted`, `growing`, `flowering`, `fruiting`, `damaged` (damaged also covers diseased or dead; put the details in the note).
  - Trees are managed in the farm's View drawer (Trees tab) and on the Tree page.
- **Harvest**: farm, variety (**only varieties the farm has tree groups of**), `yieldKg`, `harvestedAt`, `note`, `recordedBy`.
- **Archive** = soft delete (`archivedAt`) with **Restore**. Archiving a farm archives its tree groups; harvests stay.

### 3.6b Maps and boundaries (Change 05)
- Real Marinduque municipality and barangay polygons (PSGC) are served by `GET /locations/boundaries?level=municipality|barangay[&municipality=]` (public, cached for a week).
- Every map highlights the selected municipality and barangay and fits its bounds.
- Picking a barangay moves the pin to the barangay's pole of inaccessibility, so no geocoding is needed.
- Reverse geocoding uses point-in-polygon for municipality and barangay; Mapbox only fills the street.

### 3.7 Store for farmers
- The **Store** sidebar item opens `/products`, which shows only categories the user may buy (Fertilizer and Seedlings for farmers, through `catalog.farm_supplies`). Buyers still only see Coffee.
- Cart, addresses, checkout and reviews are the Phase 1 flows. Farmers manage addresses at `/dashboard/account/addresses` (`FarmerAddresses.dc.html`) and get an extra **Farm** label (Home · Work · Farm · Other). After a farmer places an order, go to `/dashboard/orders?open=<id>`.
- The farmer **Orders** page is a table with a View drawer: timeline, cancel while pending, and a link to the full order page.

### 3.8 Kaluppa orders
- One table for buyer and farmer orders (no Items column; the items show in the drawer). The Status dropdown has To confirm · Preparing · On the way · Completed · Closed · All. Other filters: customer type, delivery or pickup, payment.
- The **manage drawer** follows the Phase 1 transitions:
  - check the receipt (checkbox "The receipt matches the total"; Confirm stays disabled until it's ticked for e-wallet orders) → confirm (reserve stock) or reject (reason);
  - start processing;
  - out for delivery (rider name and phone) or ready for pickup;
  - mark sold (COD: "Cash collected" tick);
  - refund for cancelled or rejected e-wallet orders (reference number).

### 3.8b Product reviews (Kaluppa)
- The **Reviews** page (Marketplace) lists every product review from buyers and farmers.
  - Columns: product, reviewer (Buyer/Farmer), rating, an excerpt, reply status, visibility, date.
  - Filters: Status (All / Visible / Hidden), product, rating, reply status ("Needs reply" / "Replied").
  - The sidebar badge counts reviews that need a reply.
- **Kaluppa can't edit what a reviewer wrote.** It can:
  - **Reply publicly**: one reply per review, ≤ 1000 characters. Kaluppa can edit or delete it. It shows under the review on the product page as "Reply from Kaluppa", and the reviewer gets an in-app notification.
  - **Hide** a review (reason required, the reviewer is notified) and **Show it again**. A hidden review is left out of the product page and the rating recount.
- The review drawer shows: product, reviewer with "Verified purchase" and the order link, stars, text, a hidden-reason banner, the reply (edit/delete) or the reply form.
- Every reply, hide and unhide is audited.

### 3.9 Inbox (Messenger-style)
- **Kinds**:
  - `kaluppa`: one per farmer and per Group Manager, created on account creation. It's a **shared team inbox**: any Kaluppa account can reply, and messages show "Ana · Kaluppa".
  - `direct`: between co-farmers of the same association, a farmer and their Group Manager, or Kaluppa and anyone.
  - `group`: one per association; its members are the Group Manager and the approved farmers.
- **Who can start a chat**:
  - a farmer: co-farmers in the same association, their Group Manager, Kaluppa;
  - a Group Manager: farmers in its association, Kaluppa;
  - Kaluppa: anyone.
  - An unaffiliated farmer can only message Kaluppa.
  - The search ("Search co-farmers, Group Manager, Kaluppa") only returns allowed people.
- **Read-only**: when a membership ends (transfer, removal, Group Manager moved or archived), the member's `canPost` becomes false and `leftAt` is set. The history stays, and the composer is replaced by a note.
- **Features**:
  - text (≤ 2000 characters), images and files (upload rules: image 5 MB, file 10 MB), reply to a message;
  - edit within **15 minutes** (shows "Edited");
  - **delete for everyone** at any time (shows "This message was deleted") and delete for me;
  - older messages load as you scroll up (cursor, 30 per page);
  - filters: All / Unread / Groups.
- **States**:
  - **sent** when stored;
  - **delivered** when a recipient's socket receives it (or on their next fetch);
  - **seen** when the recipient opens the chat.
  - These are computed from each member's `lastDeliveredAt` / `lastReadAt` cursors, so messages aren't updated one by one.
  - Group chats show "Seen by N" with avatars.
- **Typing**: a `typing` event is throttled to once every 3 s and expires after 5 s.
- **Layout**: desktop and tablet show two panes. On a phone you see the list first, then the conversation with a back button (`InboxMobile.dc.html`).

### 3.10 Hub
- A feed for farmers, Group Managers and Kaluppa.
  - **Composer**: text, up to 10 media (images 5 MB, **videos 50 MB**), and **up to 3 tags** from `pruning, harvesting, processing, soil, advisory, announcement`.
  - Tags show as `#tag` at the end of the post. **Tag filter chips** sit above the feed.
- Posts can be edited or deleted by their author. Reactions are Phase 1's like / love / celebrate. Comments have one level of replies; authors can edit or delete them.
- **Moderation**: Kaluppa can remove any post or comment with a reason, and the author is notified. Group Managers can't.
- **Feed media layout** (fixes the Phase 1 bug where one tall photo stretched the post):
  - Feed tiles sit in a **fixed 16:10 grid** and crop with `object-fit: cover`:
    - 1 item: the full frame;
    - 2 items: two columns;
    - 3 items: one big tile plus two small;
    - 4 or more: a 2×2 grid with "+N" on the last tile.
  - The viewer and post page use a **fixed 16:10 stage** (max 560 px tall) with `object-fit: contain` on a dark background. Thumbnails are square with `object-fit: cover`.
- **Views**: a `PostView {post, user, day}` record, unique, signed-in users only. **Guests are not counted.**
- **Landing page**: shows the **3 most-viewed posts of the last 30 days**, computed hourly by a BullMQ job and cached in Valkey (`posts:top3`). Guests and buyers can open those 3 posts (public post page). Any other post asks them to sign in.
  - This replaces Phase 1's "latest posts".
  - Buyers and guests still can't react or comment.

### 3.11 Farm Map
- One pin per farm:
  - farmer: their own farms;
  - Group Manager: association farms plus its Kaluppa farm;
  - Kaluppa: all farms, with Kaluppa farms drawn darker.
- The popover shows property number, lot number, owner, association, size, trees by variety, the main stages, last harvest, "Managed by" for Kaluppa farms, and an "Open farm" link.
- Filters: association (Kaluppa only), municipality, variety. A side list selects a farm and flies to it.

### 3.12 Reports and Audit log
- **Reports** (Kaluppa: all associations; Group Manager: its association):
  - Charts:
    - harvest by variety per month (stacked);
    - beans bought (kg) per month;
    - store sales (₱, Kaluppa only);
    - trees by stage.
  - Tables: "By association" for Kaluppa, "By farmer" for Group Managers.
  - Filters: period, association.
  - **CSV export** for each section and an "Export all".
  - Aggregations run on the server; use `$facet` where it helps.
- **Audit log** (Kaluppa only, read-only):
  - It records who, role, area, action, record, and changed fields with before/after values. Only allow-listed fields go in, **never passwords or uploaded documents**. The system (jobs) is an actor too.
  - Filters: area, role, period, search. A drawer shows the diff. CSV export.

### 3.13 Settings (Kaluppa)
- **Branch**:
  - name, phone, address (municipality and barangay search dropdowns plus street) and a **map pin** (same zoom behavior), and opening hours per weekday.
  - It drives the delivery-fee starting point, the pickup card and the bean drop-off instructions.
  - Changing it affects only new quotes and listings; orders keep their saved copy.
- **Delivery fee**: base fee, the km the base covers, per-km fee, rounding, max km and the ETA business days, with a "Try it" calculator.
- **E-wallet**: GCash and Maya (account name, number, QR image ≤ 5 MB, "show at checkout").

---

### 3.14 Overview date filter (Change 06)
- Every overview has **Today · This week · This month (default) · This year**: calendar ranges in Asia/Manila, weeks starting Monday, `?period=` in the URL, remembered per user.
- `GET /dashboard/overview?period=` returns the KPIs, the comparison with the previous equivalent period, and chart buckets (today: 2-hour buckets from 6 AM; week: days; month: weeks; year: months).
- Stock-like KPIs (farms, trees, orders to confirm, listings to review) ignore the period.

### 3.15 Record history in drawers (Change 06)
- Every view drawer (and every edit drawer for an existing record) ends with **History**: actor, action, time and changed fields, newest first, 5 at a time.
- It comes from `GET /audit-logs/entity/:entityType/:entityId?cursor`. Anyone who can view the record can read its history; only Kaluppa gets "Open in audit log".
- Audited actions needed:
  - farmer request / approve / reject / transfer / remove / contact change;
  - Group Manager create / assign / move / archive;
  - association create / edit / assign;
  - farm create / edit / pin move / archive / assign farmers;
  - tree group add / edit / stage change / archive;
  - harvest record / edit / archive;
  - bean list / edit / approve / reject / complete / cancel / expire;
  - order status changes, receipt check, rider, refund;
  - product create / edit / stock / price / thumbnail / archive;
  - review reply / hide / unhide.

### 3.16 Payment providers (Change 06)
- E-wallet providers live in Settings with `showAtCheckout`.
- **For now only GCash is on**; Maya is seeded with its account details but off.
- All copy (landing, FAQ, product notes, cart, checkout, emails) is built from the enabled providers. Checkout hides the wallet tabs when only one is on.

## 4. Data models (new or changed)

**Accounts and associations**
- **User** (changed): `email` becomes optional (sparse unique; required for every role except farmers created by a Group Manager); add `mustChangePassword`, `createdBy`.
- **FarmerProfile**:
  - `user` (unique), `association|null`, `status` (`none|pending|approved|rejected`);
  - `rejectionReason`, `requestedAt`, `approvedAt`, `approvedBy`;
  - `documents {validId, landProof}` → `{url, publicId, name, bytes, kind:'image'|'pdf'}`;
  - `transferRequest? {association, reason, requestedAt}`, `history[] {action, by, at, note}`.
- **Association**: `name` (unique), `slug`, `municipality`, `description`, `groupManager|null` (unique, sparse), `groupChat`, `archivedAt`.

**Records**
- **Farm**:
  - `propertyNumber` (unique), `lotNumber`, `owner`, `ownerType` (`farmer|kaluppa`), `association`;
  - `managedBy|null`, `assignedFarmers[]`;
  - `sizeHa`, `municipality`, `barangay`, `street`, `location` (GeoJSON Point, 2dsphere);
  - `createdBy`, `archivedAt`.
  - Unique index `{owner, lotNumber}` on non-archived farms (partial index).
- **TreeGroup**: `farm`, `owner`, `association`, `variety`, `count`, `stage`, `plantedAt`, `note`, `recordedBy`, `archivedAt`.
- **Harvest**: `farm`, `owner`, `association`, `variety`, `yieldKg`, `harvestedAt`, `note`, `recordedBy`, `archivedAt`.

**Beans**
- **BeanListing**:
  - `listingNumber` (`BN-YYMM-NNNN`), `farmer`, `association` (snapshot), `recordedBy`;
  - `variety`, `form`, `weightKg`, `pricePerKgCentavos`, `photos[]`, `note`;
  - `status`, `countsTowardCap`, `approvedAt/By`, `expiresAt`;
  - `completion {finalWeightKg, finalAmountCentavos, at, by}`, `rejection {reason, at, by}`, `cancellation {reason, at, by, byRole}`, `history[]`.

**Inbox**
- **Conversation**: `type` (`kaluppa|direct|group`), `association?`, `pairKey?` (unique, for direct chats: sorted user ids), `lastMessage {text, sender, at}`.
- **ConversationMember**: `conversation`, `user` (for `kaluppa` chats the Kaluppa side is a virtual member `team:kaluppa`), `canPost`, `joinedAt`, `leftAt`, `lastDeliveredAt`, `lastReadAt`, `unreadCount`.
- **Message**:
  - `conversation`, `sender`, `body`, `attachments[]`, `replyTo`;
  - `editedAt`, `deletedForEveryoneAt`, `deletedFor[]`.
  - Index `{conversation, createdAt:-1}`.

**Hub, store and system**
- **Post** (changed): add `tags[]` (≤ 3), `viewCount`, `removedAt`, `removedBy`, `removalReason`. **PostView**: `{post, user, day}`, unique.
- **Review** (changed from Phase 1): add `reply? {body, by, at, editedAt}`, `hiddenAt`, `hiddenBy`, `hiddenReason`. The product's `ratingAverage` / `ratingCount` count visible reviews only.
- **Product** (Inventory UI): `unit` adds `sack`; `photos[]` ≤ 5, each `{url, publicId, isThumbnail}`. **Exactly one** photo is the thumbnail: the first by default; the admin picks another by clicking it; deleting the thumbnail makes the first remaining photo the thumbnail. Product cards, the cart, order item snapshots and the landing page use it; `featured` (coffee only); `active`; `archivedAt`. Low stock means below 10 (below 50 for seedlings).
- **Setting** (changed): `branch {name, phone, street, barangay, municipality, location, hours[7] {open, from, to}}` replaces `pickup.location`.
- **AuditLog**: `actor|null`, `actorRole`, `area`, `action`, `entityType`, `entityId`, `entityLabel`, `changes[{field, from, to}]`, `at`. Index `{at:-1}`, `{area, at}`.
- **Notification**: types `farmer_request`, `farmer_decision`, `transfer_decision`, `bean_status`, `message`, `post_activity`, `post_removed`.

---

## 5. API (prefix `/api`)

Every route follows the Phase 1 flow: route → **auth** → validation → controller → service → repository. Lists are page-based: `?page&limit≤50&sort&q&<filters>`, returning `{items, page, limit, total}`. Feeds and messages keep cursors.

**Account**
- `PATCH /auth/password/first {newPassword}`: for accounts with `mustChangePassword`.
- `GET /users/username-check?username` and `GET /users/username-suggestions?first&last` (Phase 1 sign-up endpoints) are also used by the Add farmer and Add Group Manager drawers. Creating or updating returns `409 USERNAME_TAKEN` on a clash.
- `GET /me/farmer-profile`, `POST /me/farmer-profile/request {associationId, validId, landProof}`, `POST /me/farmer-profile/transfer {associationId, reason?}`, `DELETE /me/farmer-profile/transfer`.

**Associations and Group Managers** (`associations.manage`, `group_managers.manage`)
- `GET/POST /associations`, `GET/PATCH /associations/:id`, `POST /associations/:id/archive|restore`. `GET /associations/options` is public to signed-in users, for the window.
- `GET/POST /group-managers`, `GET/PATCH /group-managers/:id`, `POST /group-managers/:id/archive|restore`.

**Farmers** (`farmers.manage` / `farmers.approve`, scoped)
- `GET /farmers?status&tab`, `POST /farmers` (Group Manager creates; returns `{temporaryPassword}` once when there's no email), `GET/PATCH /farmers/:id`.
- `POST /farmers/:id/approve`, `POST /farmers/:id/reject {reason}`, `POST /farmers/:id/transfer/approve|reject`, `POST /farmers/:id/remove`.

**Records** (`farms.manage` etc., scoped by policy)
- `GET/POST /farms`, `GET/PATCH /farms/:id`, `POST /farms/:id/archive|restore`, `PUT /farms/:id/assigned-farmers` (assigned Group Manager only).
- `GET/POST /tree-groups`, `PATCH /tree-groups/:id`, `POST /tree-groups/:id/archive|restore`.
- `GET/POST /harvests`, `PATCH /harvests/:id`, `POST /harvests/:id/archive|restore`.
- `GET /map/farms?association&municipality&variety` (`map.view`, scoped).

**Beans**
- `GET/POST /beans`, `GET/PATCH /beans/:id`, `POST /beans/:id/cancel`, `GET /beans/cap` (`beans.sell`, scoped).
- `POST /beans/:id/approve`, `POST /beans/:id/reject {reason}`, `POST /beans/:id/complete {finalWeightKg, finalAmountCentavos}`, `POST /beans/:id/cancel {reason}` (`beans.review`).

**Orders**: Phase 1's `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` serve farmers through permissions. Kaluppa gets `GET /admin/orders?type&method&payment&tab&page` plus the Phase 1 manage endpoints.

**Reviews** (`reviews.moderate`): `GET /admin/reviews?status&product&rating&reply&q&page`, `GET /admin/reviews/:id`, `PUT /admin/reviews/:id/reply {body}`, `DELETE /admin/reviews/:id/reply`, `POST /admin/reviews/:id/hide {reason}`, `POST /admin/reviews/:id/unhide`. The public review list leaves out hidden reviews and includes `reply`.

**Inventory and settings**
- `GET/POST /admin/products`, `PATCH /admin/products/:id`, `POST /admin/products/:id/archive|restore`.
- `GET/PATCH /admin/settings/branch|delivery|ewallet`.

**Inbox** (`inbox.use`)
- `GET /conversations?filter=all|unread|groups&q`, `POST /conversations/direct {userId}`, `GET /conversations/:id/messages?before&limit=30`.
- `POST /conversations/:id/messages {body, attachments?, replyTo?}`, `PATCH /messages/:id {body}` (≤ 15 minutes), `DELETE /messages/:id?for=everyone|me`, `POST /conversations/:id/read`.
- `GET /inbox/people?q`: allowed contacts only.

**Hub**
- `GET /hub/posts?tag&cursor`, `POST /hub/posts`, `PATCH/DELETE /hub/posts/:id`, `POST /hub/posts/:id/view`, `POST /hub/posts/:id/remove {reason}` (`posts.moderate`).
- Comments and reactions reuse the Phase 1 post endpoints with the new permissions.
- `GET /posts/top` is public (top 3).

**Reports and audit**
- `GET /reports/summary|harvest|beans|sales|trees|breakdown?period&association`, `GET /reports/export.csv?section=`.
- `GET /audit-logs?area&role&from&to&q&page`, `GET /audit-logs/:id`, `GET /audit-logs/export.csv`.

**Uploads**: `POST /uploads/signature {purpose}` adds the purposes `farmer_document` (image or pdf), `bean_photo`, `post_media` (image, or video 50 MB), `message_attachment`, `product_photo`, `wallet_qr`. Server re-checks (Change 03) apply to all of them.

---

## 6. Realtime, jobs, emails, notifications

**Socket.IO events** (Valkey adapter; rooms `user:<id>`, `conversation:<id>`, `team:kaluppa`)
- `message:new`, `message:updated`, `message:deleted`, `conversation:read`, `conversation:delivered`, `typing`;
- `notification:new`, `order:updated`, `bean:updated`.

**BullMQ jobs**
- `beans:expire` (hourly);
- `posts:top3` (hourly);
- `orders:expire` (Phase 1, unchanged);
- the email queue (Phase 1).

**Emails and in-app notifications**
| Event | To | Email | In-app |
|---|---|:-:|:-:|
| Farmer request sent | Group Manager (or Kaluppa if none) | ✓ | ✓ |
| Approved / rejected (with reason) | Farmer | ✓ | ✓ |
| Transfer approved / rejected | Farmer | ✓ | ✓ |
| Account created (invite link) | New Group Manager / farmer with email | ✓ | |
| Bean approved (branch + hours + deadline) / rejected / cancelled / expired / completed | Farmer (and their Group Manager in-app) | ✓ | ✓ |
| Order status | Buyer / farmer | ✓ | ✓ |
| New message | Members | | ✓ (badge) |
| Comment, reply, reaction | Author | | ✓ |
| Post removed (with reason) | Author | | ✓ |
| Kaluppa replied to your review / your review was hidden (with reason) | Reviewer | | ✓ |

---

## 7. Validation (shared Zod, `schemas/`)
- Lot number: 1–40 characters. Size: 0.01–500 ha. Tree count: 1–100,000. Yield: 0.5–100,000 kg in 0.5 steps. Dates can't be in the future.
- Bean weight: 0.5–10,000 kg in 0.5 steps; price ₱1–₱10,000 per kg; photos 1–5; note ≤ 500.
- Rejection / cancel / removal reasons: 5–300 characters.
- Message ≤ 2000 characters; post ≤ 5000 characters; comment ≤ 1000 characters; tags ≤ 3 from the list.
- Association name 2–80, description ≤ 500.
- **Uploads** (`UPLOAD_RULES`): image 5 MB; file (pdf) 10 MB; **video 50 MB** (Hub only).

---

## 8. Seed data (Phase 2 additions)
- **All seed emails are `@gmail.com` and every seed password is `KapeKonek@123`** (`SEED_DEFAULT_PASSWORD`). This replaces Phase 1's `@kapekonek.test` / `Password123!` (see Change 04).
  - Addresses are built from `SEED_EMAIL_BASE` when set. Gmail ignores the part after `+`, so `SEED_EMAIL_BASE=yourname@gmail.com` gives `yourname+kaluppa@gmail.com` and every seed email reaches the user's own inbox.
  - Without it, the defaults are `kapekonek.<handle>@gmail.com`. Those may belong to strangers, so **when `SEED_EMAIL_BASE` is unset, the mail worker must skip any account flagged `isSeed`** (log the email instead). Never email strangers.
- **People**:
  - Kaluppa (with branch pin and hours);
  - 3 associations, 3 Group Managers (one unassigned);
  - about 14 farmers covering every state: approved, pending, rejected, unaffiliated, a pending transfer, and one created by a Group Manager with no email and `mustChangePassword`.
- **Records**: farms with pins across all 6 towns (including 2 Kaluppa farms, one managed by the Santa Cruz Group Manager); tree groups in all 5 stages; 12 months of harvests.
- **Payments**: GCash shown at checkout; Maya saved with its account details but `showAtCheckout: false`.
- **Beans and orders**: bean listings in every status (one approved listing expiring in 1 day; one unapproved farmer at 3 of 5 kg); farmer store orders in several statuses.
- **Inbox**: conversations of every kind with sent, delivered and seen states, one edited message, one deleted for everyone, and one read-only chat.
- **Hub**: posts with tags, multi-image and video posts (including **one portrait photo** to test the fixed frames), and views so the top 3 is filled.
- **Audit**: about 30 entries.

| Handle | Role | Lands on |
|---|---|---|
| `kaluppa` | Kaluppa | `/dashboard/overview` |
| `manager.santacruz` | Group Manager, Santa Cruz Coffee Growers | `/dashboard/overview` (4 waiting) |
| `manager.unassigned` | Group Manager, no association | `/dashboard/overview` (empty state) |
| `farmer.approved` | Approved farmer | `/dashboard/overview` |
| `farmer.pending` | Waiting for approval, 3 of 5 kg used | overview with the banner |
| `farmer.new` | Verified, no association | the association window |
| `farmer.nomail` | Created by a Group Manager, username only | "Set a new password" |
| `buyer` | Buyer (Phase 1) | storefront |

---

## 9. Out of scope (later)
- Kaluppa staff management (more Kaluppa accounts), DTI, push notifications, offline mode, message reactions, and Hub post sharing.
