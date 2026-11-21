# KapeKonek — Product Spec (Phase 1: guests & buyers)

Phase 1 builds everything a **guest** and a **buyer** use, plus the backend pieces those flows depend on. Other roles get seeded accounts, permissions and a placeholder dashboard. Decisions here are final unless the user changes them.

**Business model in one paragraph:**
- Kaluppa is the only seller and does all fulfilment.
- A buyer chooses **delivery** (anywhere in Marinduque; fee from road distance) or **pickup at Kaluppa** (Pantayin, Santa Cruz, Marinduque; no fee).
- They pay by **e-wallet** (GCash/Maya QR + receipt upload) or **cash** (cash on delivery, or cash on pickup).
- Kaluppa confirms orders within 3 days or they expire. Delivery arrives in **3–5 business days** after confirmation.
- There are no pickup stations and no Station Partners.

---

## 1. Roles & permissions

Roles: `kaluppa` (super-admin), `group_manager`, `farmer`, `buyer`.

| Permission | buyer | farmer | group_manager | kaluppa |
|---|:-:|:-:|:-:|:-:|
| `catalog.coffee` (buy Coffee) | ✓ | | | ✓ |
| `catalog.farm_supplies` (buy Fertilizer, Seedlings — Phase 2 UI) | | ✓ | | ✓ |
| `cart.manage`, `addresses.manage` | ✓ | | | ✓ |
| `orders.create`, `orders.view_own`, `orders.cancel_own` | ✓ | | | ✓ |
| `reviews.create`, `reviews.update_own` | ✓ | | | ✓ |
| `notifications.view`, `profile.update` | ✓ | ✓ | ✓ | ✓ |
| `dashboard.view` | | ✓ | ✓ | ✓ |
| `orders.manage` (confirm, process, ship, complete, reject, cancel, refund) | | | | ✓ |
| `settings.manage` (delivery fee, pickup location, payment QR — Phase 2 UI) | | | | ✓ |
| `posts.react`, `posts.comment` (Phase 2 UI) | | ✓ | ✓ | ✓ |
| `posts.create` (Phase 2 UI) | | ✓ | ✓ | ✓ |

- Kaluppa passes every check as super-admin.
- Guests can read the catalog (public categories only), posts, reviews, and delivery/pickup info. **Buyers and guests can't react to or comment on posts.**
- Farmers get cart and order permissions when their shop UI ships.
- The post reaction/comment roles are the planned default; confirm them before the Phase 2 posting UI.

## 2. Data models (Mongoose)

All models use `timestamps: true`. Money is stored as integer centavos.

- **User**: `firstName`, `middleName?`, `lastName`, `username` (unique, lowercase, `^[a-z0-9._]{3,30}$`), `email` (unique), `password` (bcrypt 12, `select:false`), `emailVerifiedAt`, `roles[]`, `permissions[]`, `contactNumber?` (`09XXXXXXXXX`), `avatar? {url, publicId}`, `tokenVersion` (0), `status` (`active|suspended`), `lastLoginAt`. Virtuals `fullName`, `initials`.
- **Role**, **Permission**, **Token**: `user`, `purpose` (`verify_email|reset_password`), `tokenHash`, `email`, `expiresAt` (TTL), `usedAt`.
- **Address**: `user`, `label` (`Home|Work|Other`), `customLabel?` (when Other, ≤30), `recipientName`, `phone`, `province` (always `Marinduque`), `municipality`, `barangay`, `street` (house no., street, landmark), `postalCode` (derived from municipality), `location? {type:'Point', coordinates:[lng,lat]}`, `isDefault`, `deletedAt`. Index `{user, deletedAt}`, 2dsphere on `location`. At most **10** active addresses per user, exactly one default (the first address becomes default automatically).
- **Category**: `name`, `slug`, `purchasePermission`, `isPublic`, `hasVariety`, `hasCoffeeType`, `sortOrder`. Seeded: Coffee (public, `catalog.coffee`), Fertilizer, Seedlings (`catalog.farm_supplies`).
- **Product**: `name`, `slug`, `category`, `variety` (`liberica|excelsa|arabica|robusta|null`), `coffeeType` (`green_beans|roasted_beans|ground|null`), `shortDescription` (≤140), `description`, `images[] {url, publicId, alt}`, `priceCentavos`, `unit` (`kg|pack|piece`), `unitLabel?`, `stock`, `isFeatured`, `isActive`, `ratingAverage`, `ratingCount`, `soldCount`. Indexes: text(name, shortDescription); `{category, isActive, createdAt}`; `{priceCentavos}`; `{ratingAverage}`.
- **Cart**: `user` (unique), `items[] {product, quantity, addedAt}`.
- **Setting**: `key` (unique), `value`. Keys:
  - `delivery.fee`: `{ origin: {lat: 13.467, lng: 122.044}, baseFeeCentavos: 5000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60, roadFactorFallback: 1.35 }`. The origin is approximate; Kaluppa sets the exact pin later.
  - `delivery.eta`: `{ minBusinessDays: 3, maxBusinessDays: 5 }`.
  - `pickup.location`: `{ name: 'Kaluppa', address: 'Pantayin, Santa Cruz, Marinduque', hours: '[Opening hours]', location: {lat, lng} }`.
  - `payment.ewallet`: `{ providers: ['GCash','Maya'], accountName, accountNumber, qrImageUrl?, qrPayload, isSample: true }`.
  - `landing.heroSlides`: `[{title, subtitle, image{url,publicId,alt}, ctaLabel, ctaHref}]`.
- **Order**:
  - `orderNumber` (`KK-YYYYMMDD-NNNN`), `buyer`.
  - `items[]` snapshot `{product, name, slug, image, variety, coffeeType, unit, unitLabel, priceCentavos, quantity, lineTotalCentavos}`.
  - `subtotalCentavos`, `deliveryFeeCentavos`, `totalCentavos`.
  - `fulfillment`:
    - `method` (`delivery|pickup`), `contactName`, `contactPhone`.
    - For delivery: `address` (a snapshot of every Address field + location) and `distanceKm`, `distanceSource` (`mapbox|fallback`).
    - For pickup: `pickup` (a snapshot of `pickup.location`).
    - `rider? {name, phone}`, `etaFrom`, `etaTo`.
  - `payment`: `method` (`e_wallet|cash`), `provider?` (`GCash|Maya`), `receipt? {url, publicId}`, `submittedAt?`, `verifiedAt?`, `verifiedBy?`, `cashCollectedAt?`.
  - `status` (§3), `statusHistory[] {status, at, by|null, byRole|'system', reasonCode?, reason?, note?}`.
  - `cancellation?`, `rejection? {by, reasonCode, reason, at}`, `expiredAt?`, `stockReserved`.
  - `refund {status:'not_applicable'|'pending'|'refunded', referenceNumber?, refundedAt?, refundedBy?}`.
  - Indexes: `{buyer, createdAt}`, `{buyer, status, createdAt}`, `{status, createdAt}`.
- **Counter**: `{_id, seq}`.
- **Review**: `product`, `buyer`, `order`, `rating` 1–5, `comment` 10–1000, `editedAt?`. Unique `{product, buyer}`.
- **Notification**: `user`, `type` (`order_status|system`), `title`, `body`, `link`, `data`, `readAt`.
- **Post**:
  - `author`, `body`.
  - `media[] {type:'image'|'video', url, publicId, width?, height?, durationSec?, posterUrl?}` (0–10 items).
  - `reactionCounts {like, love, celebrate}`, `commentCount`, `isPublished`, `deletedAt`.
- **PostComment**: `post`, `author`, `parent` (null or a top-level comment; one level of replies), `body`, `reactionCount`, `replyCount`. **Reaction**: `targetType`, `target`, `user`, `type`; unique per user and target.

**Location data:**
- Copy `_reference/backend/src/seeders/data/marinduque-locations.json` (6 municipalities, 218 barangays) to `backend/src/data/`.
- Postal codes: Boac 4900, Mogpog 4901, Santa Cruz 4902, Torrijos 4903, Buenavista 4904, Gasan 4905.
- Serve them at `GET /locations`.

## 3. Order lifecycle

**Allowed combinations at checkout:**

| Method | Payment | Needs |
|---|---|---|
| Delivery | E-wallet | saved address in Marinduque + receipt |
| Delivery | Cash on delivery | saved address in Marinduque |
| Pickup at Kaluppa | E-wallet | contact number + receipt |
| Pickup at Kaluppa | Cash on pickup | contact number |

**Status machine** (`orderStatus.service` with one transition table). Kaluppa (`orders.manage`) makes every staff transition.

| From → To | Who | Rules & side effects |
|---|---|---|
| — → **pending** | buyer | See "Placing an order" below. |
| pending → **reserved** | Kaluppa | For e-wallet orders, Kaluppa verifies the receipt (`payment.verifiedAt`). Stock is deducted atomically per item (`updateOne({_id, stock:{$gte:q}}, {$inc:{stock:-q}})`); if any item fails, roll back and return `409` with the short items. Sets `stockReserved` and computes `etaFrom/etaTo` = confirmation date + 3/5 business days (Mon–Fri). |
| pending/reserved → **rejected** | Kaluppa | Reason required (`invalid_receipt`, `amount_mismatch`, `out_of_stock`, `outside_delivery_area`, `other`+text). Returns stock if it was reserved. |
| pending → **cancelled** | buyer | Reason required (`change_delivery_address`, `change_items`, `wrong_receipt`, `ordered_by_mistake`, `other`+text). |
| reserved/processing/out_for_delivery/ready_for_pickup → **cancelled** | Kaluppa | Reason required. Returns stock. |
| pending → **expired** | scheduler | Pending longer than `ORDER_EXPIRY_DAYS` (3). Conditional update on `status:'pending'`. |
| reserved → **processing** | Kaluppa | |
| processing → **out_for_delivery** | Kaluppa | Delivery orders only. Optional `rider {name, phone}` and note, both shown to the buyer. |
| processing → **ready_for_pickup** | Kaluppa | Pickup orders only. |
| out_for_delivery / ready_for_pickup → **sold** | Kaluppa | For cash orders, sets `payment.cashCollectedAt`. `soldCount += qty`. Unlocks reviews. |

- **Final statuses**: sold, cancelled, rejected, expired.
- **Refunds**:
  - When an **e-wallet** order is cancelled, rejected or expired, `refund.status` becomes `pending`. Cash orders stay `not_applicable`.
  - Kaluppa marks it refunded with a reference number (`PATCH /orders/:id/refund`).
- **Uncollected or undeliverable orders**: Kaluppa cancels them manually. There's no auto-cancel after confirmation.
- **Expiry scheduler**:
  - Copy `_reference/backend/src/schedulers/requestAutoDeny.scheduler.js`; interval `ORDER_EXPIRY_INTERVAL_MINUTES` (5).
  - Valkey lock `lock:order-expiry` (`SET NX PX`).
  - Also `POST /api/cron/expire-orders` with `x-cron-secret`.

### Delivery fee (server-side only)

```
distanceKm = Mapbox Directions (driving) road distance from delivery.fee.origin to the address location
fee = baseFee + max(0, distanceKm - baseKm) * perKm      → rounded UP to roundUpTo
seed values: ₱50 base for the first 3 km, ₱10 per km after, round up to ₱5, max 60 km
```

- A `deliveryQuote.service` calls Mapbox with the server token `MAPBOX_ACCESS_TOKEN` and caches the result in Valkey (`quote:<lat 4dp>:<lng 4dp>`, 24 h).
- If Mapbox fails: use the straight-line distance × `roadFactorFallback` and set `distanceSource:'fallback'`.
- Addresses without a pin are forward-geocoded through Mapbox (`street, barangay, municipality, Marinduque, Philippines`). If that fails, return `422 ADDRESS_NEEDS_PIN` and checkout asks the buyer to drop a pin.
- Refuse addresses outside Marinduque (municipality not in the list, or coordinates outside the province bounds) or farther than `maxKm`, with `422 OUTSIDE_DELIVERY_AREA`.
- **Never trust a fee sent by the client.** Recompute it when the order is placed.
- **Business days**: Mon–Fri, with no holiday calendar in Phase 1. Before confirmation, the UI shows the estimate as if the order were confirmed today.

### Placing an order (`POST /orders`)

**Body**: `{method, addressId?, contactPhone?, paymentMethod, provider?, receipt?, note?}`

**Checks:**
- A verified buyer with `orders.create`; the cart is valid (active items, purchasable category, quantities on their unit step and ≤ stock).
- **Delivery**: the address belongs to the user, is active and inside the delivery area. Compute the quote.
- **Pickup**: the contact phone (from the body or the profile) is required and gets saved to the profile.
- **E-wallet**: provider and receipt are required, and the receipt `publicId` must be under `${CLOUDINARY_ROOT_FOLDER}/receipts/`.
- **Cash**: no receipt.

**Then:**
1. Snapshot the items, address or pickup location, fee and distance. Generate the order number and set status *pending*.
2. Clear the cart.
3. Queue `ORDER_PLACED` to the buyer and `KALUPPA_NEW_ORDER` to `KALUPPA_ORDERS_EMAIL`.
4. Create notifications and emit `order:updated`.

## 4. API (prefix `/api`)

`A` authenticate · `O` optionalAuth · `G` guestOnly · `V` verified · `T` throttled.

**Auth**: unchanged from earlier:
- `POST /auth/register` (G), `POST /auth/login` (G, T 5/min), `POST /auth/logout` (A), `GET /auth/me` (A).
- `GET /auth/username-suggestions` (T, returns **3**), `GET /auth/username-availability` (T).
- `POST /auth/email/verify`, `POST /auth/email/verification-notification` (A, T 1/min).
- `POST /auth/forgot-password` (T), `POST /auth/reset-password`.

**Account** (A, V, `profile.update`):
- `GET/PATCH /account/profile`
- `PATCH /account/avatar`, `DELETE /account/avatar`
- `PATCH /account/email`, `PATCH /account/password`

**Addresses** (A, V, `addresses.manage`):
- `GET /addresses`
- `POST /addresses` (refuses an 11th)
- `PATCH /addresses/:id`
- `DELETE /addresses/:id` (soft delete; if it was the default, the newest remaining becomes default)
- `POST /addresses/:id/default`

**Locations & geo**:
- `GET /locations` (public): municipalities, barangays, postal codes.
- `GET /geo/reverse?lat&lng` (A, V, T 30/min): proxies Mapbox reverse geocoding and returns `{municipality, barangay|null, street, postalCode, insideDeliveryArea}`. It snaps the municipality to the nearest one in our list and the barangay by name match. If the barangay can't be matched, it returns `null` and the user picks.
- `GET /geo/search?q` (A, V, T): Mapbox forward search, limited to Marinduque.

**Delivery**:
- `GET /delivery/quote?addressId=` or `?lat&lng` (A, V): `{distanceKm, feeCentavos, distanceSource, eta:{from,to}}`.
- `GET /delivery/info` (public): pickup location, fee rules for display, ETA days.

**Uploads**: `POST /uploads/signature {type:'avatar'|'receipt'}` (A, V).

**Catalog** (O):
- `GET /categories`
- `GET /products` (search, category, variety[], coffeeType[], minPrice, maxPrice, featured, sort, cursor, limit ≤24)
- `GET /products/:slug`
- `GET /products/:id/reviews`, `/reviews/summary`, `/reviews/me` (A, V)

**Reviews** (A, V): `POST /products/:id/reviews`, `PATCH /reviews/:id`.

**Cart** (A, V, `cart.manage`):
- `GET /cart` (lines, flags, subtotal, `canCheckout`)
- `POST /cart/items`, `PATCH /cart/items/:productId`, `DELETE /cart/items/:productId`, `DELETE /cart`

**Settings**: `GET /settings/payment` (A, V), `GET /settings/landing` (public).

**Orders**:
- `POST /orders` (A, V, `orders.create`)
- `GET /orders?status=<one or comma-separated list>&cursor`, `GET /orders/counts` (per status; the UI sums them into groups)
- `GET /orders/:id` (owner or Kaluppa)
- `POST /orders/:id/cancel {reasonCode, reason?}`
- *Staff endpoints, no UI in Phase 1 (used for testing):*
  - `PATCH /orders/:id/status {status, reasonCode?, reason?, note?, rider?}`
  - `PATCH /orders/:id/refund {referenceNumber}`

**Notifications**:
- `GET /notifications?cursor`, `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`

**Posts** (public, O):
- `GET /posts/latest?limit=3`, `GET /posts/:id`
- `GET /posts/:id/comments?cursor&limit=5` (each with up to 2 replies and its `replyCount`)
- `GET /comments/:id/replies?cursor`

**Cron**: `POST /cron/expire-orders`. **Health**: `GET /health`.

## 5. Realtime (Socket.IO + Valkey adapter)

- Used only for notifications and order updates.
- Cookie auth at handshake. Each socket joins its own room `user:<id>`.
- Events: `notification:new`, `order:updated {orderId, status}`.
- The client invalidates the matching queries on each event.

## 6. Emails (BullMQ)

| Job | Contents |
|---|---|
| `VERIFY_EMAIL`, `RESET_PASSWORD` | Link to the frontend. |
| `EMAIL_CHANGED_NOTICE` | Sent to the old address. |
| `ORDER_PLACED` | Items, totals, delivery fee, method, payment instructions, ETA window. |
| `ORDER_STATUS_CHANGED` | Every status. Includes the rider for out for delivery, the pickup address and hours for ready for pickup, and the reason plus refund note for cancelled/rejected/expired. |
| `KALUPPA_NEW_ORDER` | Sent to `KALUPPA_ORDERS_EMAIL`. |

## 7. In-app notifications

**Buyer**: every status change (with rider or ETA details), refund marked. **Kaluppa**: new order. These are stored now; the Kaluppa UI comes in Phase 2.

## 8. Pages (screen files in `docs/DESIGN.md` §5)

- **Guards**:
  - `StorefrontRoute`: guest or buyer; other roles go to `/dashboard/overview`.
  - `GuestRoute`; `ProtectedRoute` with `permissions` and `requireVerified`; `RoleRedirect`.
  - `?redirect=` is only followed for internal paths.
- **Landing**:
  - hero carousel and featured coffee;
  - varieties, then "How ordering works" (3–5 business days, 3-day confirmation note);
  - latest posts, for farmers, what KapeKonek does, FAQ (delivery, payment, arrival time, expiry, cancel), closing call to action, footer.
- **Products, Product detail, Post detail**:
  - Same as the screens.
  - The product page notes say: delivery anywhere in Marinduque or pickup at Kaluppa; GCash, Maya or cash on delivery; arrives in 3–5 business days after confirmation.
- **Cart drawer**: stacked Checkout/Clear buttons, with confirmations.
- **Checkout**:
  1. **Delivery method** cards: deliver to my address / pick up at Kaluppa.
  2. **Delivery**: saved addresses as radio cards (default pre-selected), each showing distance and fee, with Edit and **Add new address** (opens the address window). **Pickup**: the Kaluppa card plus a required contact number.
  3. **Payment** cards: "GCash or Maya" or "Cash on delivery" / "Cash on pickup". E-wallet shows the QR tabs, account details, exact amount and receipt upload; cash shows a "prepare ₱X" note.
  4. Optional note.

  The summary shows subtotal, delivery fee with km (or "Pickup · Free"), total, destination, **estimated delivery date range**, payment, and "Place order" (with confirmation).
- **Addresses** (`/addresses`, also in the avatar dropdown):
  - cards with label, Default badge, recipient, phone, street, area and pin status;
  - Edit, Set as default, Delete (with confirmation); "Add new address" (max 10).
- **Address window** (add/edit; used from Addresses and Checkout):
  - Map side: Mapbox map with a draggable pin, search box and "Use my location". Dropping the pin auto-fills municipality, barangay (when matched), street and postal code through `/geo/reverse`.
  - Form side: label chips (Home/Work/Other), recipient name, phone, province (fixed), municipality and barangay selects (from `/locations`), street/landmark, postal code (read-only), "Set as default".
  - Shows a fee preview. The buyer can type everything without a pin; the backend geocodes on save.
  - Pins outside Marinduque show an inline error.
- **Orders**: six group cards with counts (All orders · To confirm = pending · Preparing = reserved + processing · On the way = out for delivery + ready for pickup · Completed = sold · Closed = cancelled + rejected + expired). Groups with several statuses show status chips to narrow further. Cards show the destination line (Delivery · Home, Barangay, Municipality / Pickup · Kaluppa) and a payment chip.
- **Order detail**:
  - status banner (out for delivery shows the rider and the cash amount to prepare; ready for pickup shows the address and hours) plus the estimated delivery range;
  - items with subtotal, delivery fee and total;
  - delivery address or pickup card;
  - payment card (e-wallet: receipt, verification and refund status; cash: amount to pay);
  - timeline ("Status history"); cancel while pending (with reason).
  - Full-width layout (see `OrderDetail.dc.html`); there is no chat.
- **Profile** (no side menu; navigation lives in the avatar dropdown: Profile, Orders, Addresses, Settings, Log out), **Settings**, **Auth** pages, **Dashboard placeholder** (farmer, Group Manager, Kaluppa), **403/404**.

## 9. Validation rules (shared Zod)

- Password: ≥8 characters with a letter, a digit and a symbol. Username: `^[a-z0-9._]{3,30}$`. Names: 1–50 characters.
- Phone: `^09\d{9}$` (spaces removed first).
- **Address**:
  - `recipientName` 2–80, `phone` as above, `street` 5–200, `customLabel` ≤30;
  - `municipality` must be in the list, and `barangay` must belong to that municipality;
  - `location` optional (lat 13.15–13.62, lng 121.80–122.20).
- Review comment 10–1000. Cancel "other" 5–300. Rider name 2–60.
- Uploads: avatar 2 MB (jpg/png/webp), receipt 5 MB (jpg/png/webp/heic).

## 10. Commands

```
npm run dev                         # root: both apps
npm run migrate:fresh [-- --seed]   # backend; refuses in production without --force
npm run db:seed [-- --only=roles,users,categories,products,settings,addresses,posts,demo]
npm test        npm run test:e2e
```

Seeders follow `_reference/backend/src/seeder.js`:
- Reference data is upserted by natural key.
- Demo activity (orders, reviews, notifications, comments, reactions) is skipped if it already exists, unless run from `migrate:fresh`.

## 11. Seed data

**Accounts** (all `@kapekonek.test`, password `Password123!`):

| Role | Accounts |
|---|---|
| Kaluppa | `kaluppa@` |
| Group Manager | `manager@` |
| Farmer | `farmer1@`, `farmer2@` (one unverified) |
| Buyer | `buyer@` (verified), `buyer.unverified@` |
| Extra buyers | ~20 (faker) |

- **Addresses** for `buyer@`:
  - Home (default): Lot 12, Purok 3, near the chapel, Balanacan, Mogpog, pinned.
  - Work: Municipal Hall, Banahaw Poblacion, Santa Cruz, pinned.
  - Mama's house (Other): Caganhao, Boac, no pin.
  - Extra buyers get one address each.
- **Settings**: `delivery.fee`, `delivery.eta`, `pickup.location`, `payment.ewallet` (sample), `landing.heroSlides` (3), all with the values in §2.
- **Products**: Coffee for each variety × green beans (kg) / roasted (250 g pack) / ground (250 g pack), about 12–16 items with realistic PHP prices, a few low-stock and one out of stock, 4–6 featured. Hidden fertilizer (~5) and seedlings (one per variety). Plain, factual descriptions.
- **Photos & videos**:
  - Relevant Unsplash/Pexels images (beans, roasting, coffee farms, seedlings, fertilizer sacks, packed orders) and 1–2 short Pexels coffee videos.
  - **Check that each URL returns 200 with an image or video content type** before saving it to `seeders/data/media.json` `{key, url, source, author, license}`.
  - Upload to Cloudinary (`seed/<key>`, `overwrite:false`); if an upload fails, keep the remote URL.
  - Avoid identifiable faces.
- **Orders** for `buyer@`:
  - about 15, covering all 9 statuses, with delivery and pickup orders and both payment methods mixed;
  - fees computed by the real formula (with the fallback distance if Mapbox isn't configured);
  - histories, rider notes, ETAs, refund states (pending + one refunded), notifications.
- **Reviews**: extra buyers get sold orders and reviews; at least 2 products have ≥12 reviews.
- **Posts**: about 8 (text-only, multi-image, one video), with comments, replies and reactions from farmers, the Group Manager and Kaluppa.

## 12. Environment variables

**Backend**:
- `NODE_ENV`, `PORT`, `CLIENT_URL`, `MONGO_URI`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_EXPIRES=15m`
- `MAIL_TRANSPORT=brevo|log`, `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME=KapeKonek`, `KALUPPA_ORDERS_EMAIL`
- `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_USERNAME=default`, `VALKEY_PASSWORD`, `VALKEY_TLS=true`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_ROOT_FOLDER=kapekonek`
- `MAPBOX_ACCESS_TOKEN` (server-side: directions + geocoding)
- `ORDER_EXPIRY_DAYS=3`, `ORDER_EXPIRY_INTERVAL_MINUTES=5`, `CRON_SECRET`, `SEED_DEFAULT_PASSWORD=Password123!`

**Frontend**: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_MAPBOX_TOKEN` (public `pk.` token, URL-restricted).

## 13. Out of scope for Phase 1

- Kaluppa / Group Manager / farmer screens beyond the placeholder, including the settings UI for delivery fees, pickup location and QR.
- Posting, reacting, commenting; in-app messaging of any kind (a future dashboard feature).
- Product management; the farmer shop; bean sales.
- Analytics; a rider role; courier integrations; a holiday calendar for ETAs; delivery outside Marinduque.
