# KapeKonek — Design Guide

The approved screens live in `docs/design/screens/` (exported from the Claude Design canvas "KapeKonek — Phase 1 Pages"). **They are the source of truth.** Build the React UI so each page looks and behaves like its screen file: same layout, spacing, sizes, copy, colors and states.

The look is AgriCentral's layout language (`_reference/frontend`) in a coffee palette, with Poppins.

## 1. How to read a `.dc.html` screen file

Each file is a self-contained HTML page written for the design canvas. Read it as a spec:

| In the file | What it means for React |
|---|---|
| `style="…"` inline styles | **Exact values.** Convert to Tailwind classes using the tokens below (e.g. `#7B4A2A` → `bg-roast`, `padding: 96px 0` → `py-24`). Keep the numbers. |
| `<helmet><style>` | Page basics, hover/focus rules, `@media` breakpoints. Port these to Tailwind variants. |
| `{{ name }}` | A data binding. The value comes from `renderVals()` in the `<script type="text/x-dc">` block at the bottom. |
| `<sc-for list="{{ items }}" as="p">` | `items.map(p => …)` |
| `<sc-if value="{{ cond }}">` | `{cond && …}` |
| `<dc-import name="Navbar" variant="buyer">` | Render the shared `<Navbar variant="buyer" />` component (its own file is `Navbar.dc.html`). |
| `href="Products.dc.html"` | A link to that screen's route (see the map in §5). |
| `renderVals()` data arrays | **Sample data only.** Replace with API data via TanStack hooks. Keep the shapes as a guide. |
| `state` / `setState` handlers | The interaction to rebuild (filters, steppers, tabs, toggles). See §6. |
| Labeled photo boxes (`Photo · …`), `[Address]`, `[Opening hours]`, `[Kaluppa account name]`, SAMPLE QR | Placeholders. Use real images/data from the API and seed data. |

`docs/design/screens/canvas.json` lists every screen with its title and canvas size.

## 2. Tokens (Tailwind v4 `@theme` in `frontend/src/index.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: "Poppins", ui-sans-serif, system-ui, sans-serif;

  /* brand */
  --color-espresso: #2B1A12;      /* headings, dark bands, footer */
  --color-espresso-2: #3A2419;    /* hero/auth panel base under the photo */
  --color-roast: #7B4A2A;         /* primary buttons, links, active states */
  --color-roast-hover: #653B20;
  --color-caramel: #C8913A;       /* icon tiles, stars, decor (never body text on white) */
  --color-caramel-light: #EBC98F; /* caramel text on dark backgrounds */
  --color-caramel-tint: #F3E3C7;  /* icon tiles, role badges */
  --color-caramel-ink: #8A5A12;   /* category labels, small caramel text on white */
  --color-crema: #F7EFE4;         /* soft sections, info boxes */
  --color-foam: #F5F0EA;          /* app/page background on account pages */
  --color-cream: #FBF8F4;         /* card header/footer bands */
  --color-highlight: #FBF6F0;     /* selected radio-card background */

  /* lines & surfaces */
  --color-sand: #E7DCCD;          /* card borders */
  --color-sand-strong: #DCCBB5;   /* input & outline-button borders */
  --color-sand-soft: #EFE6DA;     /* inner dividers */
  --color-photo: #EADCCB;         /* image placeholder background */
  --color-skeleton: #F1E9DE;

  /* text */
  --color-ink: #2B1A12;
  --color-ink-2: #4A3A30;         /* body */
  --color-ink-3: #6B5A4E;         /* muted, labels */
  --color-ink-4: #7A6A5E;         /* faint, timestamps */

  /* feedback */
  --color-success: #2E7D4F;  --color-success-ink: #22633A;  --color-success-bg: #E1F2E4;
  --color-positive-bg: #F1F8F3; --color-positive-line: #BFE0C8; --color-positive-ink: #1E4D30;
  --color-notice-bg: #FBF3E3; --color-notice-line: #EBD3A6; --color-notice-ink: #5C3D0E;
  --color-danger: #B3261E;   --color-danger-ink: #9B2C24;   --color-danger-bg: #FBE4E2;

  /* map */
  --color-water: #DCE7EA; --color-land: #EFE6D6;

  --radius-control: 5px;   /* buttons, inputs */
  --radius-card: 8px;
  --shadow-card-hover: 0 14px 32px -20px rgba(43,26,18,.38);
  --shadow-dropdown: 0 18px 40px -20px rgba(43,26,18,.45);
  --shadow-modal: 0 24px 48px -24px rgba(43,26,18,.5);
  --shadow-drawer: -24px 0 48px -24px rgba(43,26,18,.4);
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### Order status colors

| Status | Background | Text | Dot |
|---|---|---|---|
| Pending | `#FDF1DC` | `#7A4A00` | `#D98E04` |
| Reserved | `#E3EEF8` | `#1F4E79` | `#2F6690` |
| Processing | `#F3E3C7` | `#6E420E` | `#C8913A` |
| Out for delivery | `#DDF0EA` | `#1E5E4A` | `#2E8B6E` |
| Ready for pickup | `#DDF0EA` | `#1E5E4A` | `#2E8B6E` |
| Sold | `#E1F2E4` | `#22633A` | `#2E7D4F` |
| Cancelled | `#EEEAE6` | `#5E534B` | `#8C8077` |
| Rejected | `#FBE4E2` | `#9B2C24` | `#C62828` |
| Expired | `#E9ECEF` | `#495057` | `#868E96` |

Put these in one `constants/orderStatus.js` map used by `StatusPill`, tabs and timeline.

## 3. Type, spacing, shape

- **Font**: Poppins 400/500/600/700, self-hosted with `@fontsource/poppins`.
- **Scale** (desktop → mobile):
  - Hero H1 56px / 1.08 / 500 / -0.02em → 36px
  - Section H2 38px / 1.12 / 500 / -0.02em → 28px
  - Page H1 36–40px / 500 → 28px
  - Card title 15.5px / 600 · Body 15–16px / 1.65 · Small 12.5–13.5px
  - **Eyebrow**: 11px / 500 / uppercase / tracking 0.16em / `ink-3` (on dark: `caramel-light`). **Text only, with no bar, dash or line before it.**
  - **Field label**: 10.5px / 500 / uppercase / tracking 0.16em / `ink-2`
  - **Category label**: 10.5px / 600 / uppercase / tracking 0.14em / `caramel-ink`
- **Containers**: storefront 1280px max, 32px side padding (20px mobile). Account pages 1080px. Post page 800px. Auth form 400px (sign-up 480px).
- **Section rhythm**: 96px vertical padding on landing sections (64px mobile). Navbar 64px tall.
- **Radius**: controls 5px, cards 8px, thumbnails 6px, pills 999px.
- **Touch targets** ≥ 44px. Focus: 2px roast outline, 2px offset. Inputs on focus: roast border + `0 0 0 3px rgba(123,74,42,.18)` ring.
- **Motion**: sections fade up 16px over 0.5s with `--ease-out-soft` (framer-motion `whileInView`, once). Respect `prefers-reduced-motion`.

## 4. Components to build (and where they appear)

| Component | Screen file(s) | Notes |
|---|---|---|
| `Navbar` (`guest` / `buyer`) | Navbar | Logo → role home. Products, How it works. Cart icon + count. Guest: Log in, Get started. Buyer: bell with unread count, avatar button → **dropdown** (name, @username, Profile, Orders, Addresses, Settings, Log out). Mobile menu button. |
| `Footer` | Footer | Espresso background. Shop / Help / Legal columns, © line. |
| `Eyebrow`, `SectionHeading` | all | Uppercase label (no bar), then H2 + lead paragraph. |
| `Button` | all | `primary` (roast), `outline` (white + sand-strong), `danger`, `light` (crema on dark), `glass` (white/10 on dark), `caramel` (on dark), `link`. |
| `Input`, `Label`, `FieldHint`, `Textarea` | Login, Register, Settings, Profile, Checkout | |
| `SearchSelect` | SearchSelect (component), Components, AddressModal, Products (sort) | **Every select in the app.** No native `<select>`. Props: `label?`, `options` (strings or `{value,label}`), `value`, `onChange`, `placeholder`, `searchPlaceholder`, `icon` (`pin`/`home`/`sort`/`tag`/`none`, leading tile), `size` (`md` 44px / `sm` 40px), `searchable` (default true), `disabled`, `error`, `aria-label` when there's no label. Trigger: icon tile, value, round chevron that flips and fills roast when open. Popover: search input, highlighted match, check on the chosen option, "No match for …", footer count + key hints. Keyboard: ↑ ↓, Enter, Esc, type to filter; outside click closes. Works with react-hook-form via `Controller`. |
| `FileDrop` | Components, Checkout (receipt), Profile (avatar button) | `kind: 'image' \| 'file'` reads `UPLOAD_RULES`; checks type and size before uploading and shows the "too large" state. |
| `ReviewPanel` | ProductDetail, Components | States: guest (Sign in), not purchased, ordered but not completed, write, **your review** (stars, text, Posted/Edited stamp, Edit, Delete with inline confirm), edit form (Cancel / Save changes). |
| `PasswordInput` + `PasswordRule` | Login, Register, ResetPassword, Settings | Eye toggle (aria-pressed). Rule line "At least 8 characters with a letter, a number and a special character" turns green with a check when valid. |
| `RadioCard` | Register (role), Checkout (method, address, payment), Modals (cancel reason) | Selected: 2px roast border + highlight background. |
| `ChipToggle` | Products (variety) | Selected: roast fill, white text, check icon. |
| `ProductCard` | Main, Products | 4:3 image, category label, name, short detail, rating, price / unit, Add button. Out-of-stock and "Only N left" badges. |
| `StarRating` (display, picker) | ProductDetail | Caramel fill. |
| `QuantityStepper` | ProductDetail, CartDrawer | Unit-aware step; takes `max` (Product detail: `stock − inCart`; Cart: `stock`); `+` disabled at the cap with the hint line. |
| `CartDrawer` | CartDrawer | Right drawer 460px. Items, warnings, subtotal, **stacked full-width buttons: Checkout (primary) then Clear cart (outline)**. Checkout disabled (still labeled "Checkout") when any item is over stock. |
| `ConfirmDialog` | Modals | Icon tile, title, text, two buttons. Cancel-order variant with reason radio list + "Tell us more" (required for Other) + refund note. |
| `StatusPill`, `RefundBadge` | Orders, OrderDetail | |
| `OrderGroupTabs` + `StatusChips` | Orders | Six group cards (icon tile, count, label, hint): All orders, To confirm (pending), Preparing (reserved + processing), On the way (out for delivery + ready for pickup), Completed (sold), Closed (cancelled + rejected + expired). Active card: 2px roast border, highlight bg, roast icon tile. Groups with several statuses show status chips underneath (All · each status with its color dot); the active chip is espresso-filled. |
| `OrderCard` | Orders | Header band (number, date, pills), item table, footer (destination line + payment chip, total, View details). |
| `StatusTimeline` | OrderDetail | Done steps roast, current step teal, upcoming grey. |
| `AccountCard` | Profile, Settings, Addresses | Card with header band, body grid, footer band with actions. **No side menu** — account navigation lives in the avatar dropdown only. |
| `AuthLayout` | Login, Register, ForgotPassword, ResetPassword, VerifyEmail | Split: left brand panel (photo + espresso gradient + contour lines, logo, eyebrow, tagline) hidden under 900px; right swaps forms via `<Outlet />`. |
| `AddressCard` | Addresses, Checkout | Label, Default badge, recipient · phone, street, area, pin status; actions Edit / Set as default / Delete. In Checkout it's a radio card showing distance + fee. |
| `AddressFormModal` + `MapPicker` | AddressModal | Two columns. **Map**: search box, "Use my location", zoom controls (+, −, fit Marinduque), click/drag pin → `/geo/reverse` auto-fills fields, outside-area error, zoom label bottom-left. Municipality select → `flyTo` the municipality; barangay select → `flyTo` closer and show the dashed approximate-area ring. **Form**: label chips, recipient, phone, province (read-only), municipality and barangay `SearchSelect`s, postal code (read-only), street/landmark, default checkbox, fee preview (or "Drop a pin or pick your barangay…" before a pin exists). Footer: Cancel / Save address. |
| `DeliveryMethodCards`, `PaymentCards` | Checkout | Delivery vs Pickup; e-wallet vs cash (label switches to "Cash on delivery" / "Cash on pickup"). |
| `EtaLine` | Checkout, OrderDetail | Calendar icon + "Estimated delivery Nov 25 – Nov 27" + "3–5 business days after Kaluppa confirms". |
| `MediaViewer` | PostDetail | Big viewer with prev/next + "n / total", thumbnail strip, video play button + duration. |
| `ReactionSummary`, `CommentThread` | PostDetail | Read-only for guests/buyers. Replies collapse/expand. |
| `EmptyState`, skeletons | Products, Orders | Icon tile + title + one line. Pulsing skeleton cards. |
| `DashboardLayout` | Dashboard | White sidebar (Overview + "Soon" items), top bar, unverified banner. |

## 5. Screen → route map

| Screen file | Route | Who |
|---|---|---|
| `Main.dc.html` | `/` | guest, buyer |
| `Products.dc.html` | `/products` | guest, buyer |
| `ProductDetail.dc.html` | `/products/:slug` | guest, buyer (review form only for eligible buyers) |
| `PostDetail.dc.html` | `/posts/:id` | guest, buyer (view only) |
| `CartDrawer.dc.html` | drawer over any storefront page | verified buyer |
| `Checkout.dc.html` | `/checkout` | verified buyer |
| `Orders.dc.html` | `/orders` | verified buyer |
| `OrderDetail.dc.html` | `/orders/:id` | verified buyer (owner) |
| `Profile.dc.html` | `/profile` | verified buyer |
| `Settings.dc.html` | `/settings` | verified buyer |
| `Login.dc.html` | `/login` | guest |
| `Register.dc.html` | `/register` | guest |
| `ForgotPassword.dc.html` | `/forgot-password` | guest |
| `ResetPassword.dc.html` | `/reset-password?token=&email=` | anyone with a valid link |
| `VerifyEmail.dc.html` | `/verify-email` (+ `/verify-email/confirm?token=`) | logged-in unverified user |
| `Modals.dc.html` | dialogs used across pages | — |
| `Dashboard.dc.html` | `/dashboard/overview` | kaluppa, group_manager, farmer |
| `SearchSelect.dc.html` | shared component (`components/ui/SearchSelect.jsx`) | — |
| `Components.dc.html` | SearchSelect states, upload rules, review panel states | — |
| `Addresses.dc.html` | `/addresses` | verified buyer |
| `AddressModal.dc.html` | modal over `/addresses` and `/checkout` | verified buyer |
| `Navbar.dc.html`, `Footer.dc.html` | shared | — |

## 6. Interactions to rebuild

- Landing FAQ accordion (one open at a time). Hero carousel with arrows, dots, "01 / 03", autoplay that pauses on hover/focus.
- Products: variety chips, coffee-type checkboxes, price range, sort (`SearchSelect`, small), search — all synced to the URL query; infinite scroll with skeleton row and "Loading more coffee…".
- Product detail: thumbnail switching, unit-aware quantity stepper capped at `stock − inCart` with the "already in your cart" line, star picker, review panel (your review → Edit / Delete with inline confirm → write again), "Load more reviews". List badge reads "Verified purchase".
- Cart: steppers capped at stock ("That is all we have" hint), over-stock warning when stock dropped after adding, Checkout disabled while any warning shows.
- Checkout: delivery/pickup cards switch section 2 (saved addresses vs Kaluppa pickup card + contact number); payment cards switch between e-wallet (tabs only when more than one wallet is enabled; GCash only for now, QR, receipt upload) and the cash note; the summary updates fee, total, destination, ETA and payment live.
- Addresses: set default, edit, delete (confirm), add (opens modal).
- Address modal: click/drag pin → fields fill; municipality select flies the map to it and drives barangay options and postal code; barangay select flies closer; zoom buttons; outside-area pin shows the error.
- Orders: group cards filter the list; status chips narrow it inside a group; infinite scroll.
- Order detail: full-width layout (no chat); the timeline and status banner update live on `order:updated`.
- Register: role cards, username availability (green/red), 3 one-line suggestion chips, password rule.
- Verify email: resend button with 60-second cooldown.
- Navbar: avatar dropdown (click, Esc, outside-click to close), cart count, unread count.
- Post: media viewer, reaction breakdown toggle, reply expand/collapse, "Load more comments".

## 7. Images

Seeded stock photos (see PRODUCT-SPEC §11) replace every photo box:
- Product card 4:3, product detail 1:1 gallery, post media 16:10, hero full-bleed with the espresso gradient overlay from `Main.dc.html`, auth panel full-height with the same overlay.
- Always set `alt` text from the product/post data. Lazy-load below the fold. Use Cloudinary transformations (`f_auto,q_auto,w_…`).

---

## 8. Dashboard (Phase 2)

The dashboard screens are the canvas rows titled "Dashboard". Each page has a **Tweaks** prop (`role`, `status`, `start`, `tab` or `conv`) that switches the variant the screen shows; read the `renderVals()` branches for each role.

### 8.1 Shell
- **`Sidebar.dc.html`**:
  - white, 256px wide, with sections Dashboard / Records / Community / Marketplace / Map / Insights / System per role;
  - roast fill on the active item; badges (roast fill means an action is waiting);
  - "Store" shows an external-link icon;
  - an association card at the bottom for farmers and Group Managers.
  - Below 960px the sidebar hides and the top bar shows a menu button that opens it as a drawer.
- **`DashTopbar.dc.html`**: breadcrumb, a cart button (farmers only), the bell with unread count, and the avatar menu (Profile, Account settings, Addresses and Storefront for farmers, Log out).
- **Page**: `main` max-width 1240px, padding 28/32px, gap 20px. The page header has an eyebrow, an H1 at 30px/500, a description and actions on the right.

### 8.2 Shared components
| Component | Screen | Notes |
|---|---|---|
| `DataTable` | `DataTable.dc.html` (used on every list page) | **No tabs or count chips above the table.** Toolbar uses `justify-content: space-between`: search on the left; on the right a filter group of **plain dropdowns** (the same `SearchSelect` look, size `sm`, `searchable={false}`: no search box), with "Clear filters" before them. The old view tabs (Active/Archived, Waiting/Approved…) are the first dropdown, labeled **Status**. Then the table (11px uppercase headers on `#FBF8F4`, 12/14px cells, person / pill / two-line / mono cells, icon row actions: view, edit, archive, restore, review, manage, cancel) → footer ("Showing 1–6 of 24", numbered pages). Empty state with an icon. Wide tables scroll inside the card; **below 640px rows become cards**. |
| `Drawer` | every Add / Edit / View | Right side, **600–720px**, backdrop `rgba(43,26,18,.42)`. **Roomy, not compact**: header padding 22/32px with a 20px title; body padding 28/32/32px with **24px between blocks**; 20px gaps in 2- and 3-column field grids; 44px inputs with 8px between label and input; section headings get a hairline divider and 18px space above. Footer padding 18/32px on `#FBF8F4`, actions on the right. Esc closes it; focus is trapped. |
| `ConfirmModal` | `DashModals.dc.html` | Archive, restore, reject (reason required), cancel sale, remove post, reset password, delete message, save changes. Icon circle tinted by tone. |
| `MapPicker` / `FarmMap` | `MiniMap.dc.html` | Mapbox in the app. Pins: farmer farm roast `#7B4A2A`, Kaluppa farm espresso `#2B1A12`, new or edited pin caramel `#C8913A`. The pin scales with selection; the popover card shows key/value rows and "Open farm". Zoom +/−/fit controls. The dashed caramel ring marks a barangay's area. |
| `BarChart` | `BarChart.dc.html` | Thin bars with 4px rounded tops anchored at the baseline, 2px gaps between stacked segments, light grid lines, a hover column with a dark tooltip, a legend for 2+ series, and a **"View as table"** toggle. One y-axis only. |
| `StageBar` | overviews, Reports | Segmented horizontal bar (2px gaps) plus a legend list with counts and percentages. |
| `CapMeter` | farmer overview, Beans | Amber card with a progress bar: "3 kg of 5 kg used". |
| `ChatList`, `ChatThread`, `MessageBubble`, `Composer` | `Inbox.dc.html`, `InboxMobile.dc.html` | Mine: roast bubble, white text, radius 14/14/4/14. Theirs: white with a sand border. Deleted: dashed outline, italic. Replies quote with a caramel left bar. Status line under my last message: ✓ Sent / ✓✓ Delivered (gray) / ✓✓ Seen (roast) or "Seen by N" with avatars. Hover actions: Reply, ⋯ (Edit within 15 min, Delete for everyone, Delete for me). Typing shows three dots. Read-only chats replace the composer with a note. |
| `PostCard`, `CreatePostModal`, `PostViewer`, `ReactionPicker`, `CommentThread` | `Hub.dc.html`, `HubCreatePost`, `HubPostView`, `HubPostText`, `HubMobileCreate`, `HubMobileView` | **Create post modal**: 560 px, centered title + round close, author row with an audience chip, a borderless textarea (19 px text, 15 px once media is added), an upload dropzone, a media grid with remove buttons, tag chips, an "Add to your post" bar (photo and tag icon buttons), and a full-width Post button (disabled until there is text or media); full screen on phones. **Post viewer**: details panel on the left (400 px), dark media stage on the right. |
| `PostCard` (feed) | `Hub.dc.html` | **Fixed 16:10 media grid** (1 / 2 / 1+2 / 2×2 with "+N"), cover crop; the viewer uses contain on a dark stage. Tag chips under the text. Role badge: Farmer green, Group Manager blue, Kaluppa espresso. The "On the landing page" badge marks the top-3 posts. |

| `Button` | `Buttons.dc.html` | One component. `variant` solid · outline · soft · ghost · danger · danger-outline · success · link (+ light / glass / caramel on dark), `size` sm 36 · md 42 · lg 48, `leftIcon` / `rightIcon`, `iconOnly`, `loading`, `fullWidth`, `as`. Hover, focus (2px roast ring, offset 2) and disabled (45% opacity) as on the board. |
| Icons | all screens | `react-icons/lu` (Lucide) through `components/ui/icons.js`. Inline SVGs in the screens are just Lucide drawings. |
| Area highlight | `MiniMap.dc.html`, `AddressModal.dc.html`, `FarmForm`, `FarmView`, `FarmMap`, `SettingsKaluppa`, `FarmerAddresses` | Municipality: fill `rgba(200,145,58,.16)` + 2px `#C8913A`. Barangay: fill `rgba(123,74,42,.24)` + 2px `#7B4A2A`, with the municipality outline still shown. The map fits the bounds of the highlighted area. The shapes on the canvas are approximations; the app uses real PSGC polygons (Change 05 Part C). |
| `UsernameField` | `Register`, `FarmerForm`, `GroupManagerForm` | `@` prefix, a status line with an icon, and 3 one-line suggestion chips. |
| `AccountNav` | `FarmerAssociation`, `FarmerAddresses` | A pill bar with icons; the active item is crema with an espresso label. |

| `DateRangeSegmented` | `Overview*` | White pill bar (4px padding, 8px radius). Segments 36px tall, 13px/600 text; the active segment is espresso with white text. "Showing <period> · <range>" sits to its left. |
| `History` | every view drawer (and edit drawers for an existing record) | A section with a hairline divider and the uppercase title "History", plus "Open in audit log" (Kaluppa only). Entries: 30px avatar, a vertical connector line, "**Name** action" at 13.5px, the time at 12px on the right, and changed fields as `field` <del>before</del> → **after** (red / green). |
| Thumbnail star | `Inventory`, `InventoryForm` | A 26px round button at the photo's top-left. Outline roast star on white for normal photos; filled white star on roast for the thumbnail. No text badge. |
| Inbox inputs | `Inbox`, `InboxMobile` | The search and composer use **5px corners** (like the DataTable search); the send button is 42px square with 5px corners. Avatars show the profile photo when there is one, otherwise initials. The "…" menu opens directly below its button. |

### 8.3 Chart colors (validated with the dataviz checker; don't change the order)
- **Varieties** (categorical): Liberica `#2a78d6`, Excelsa `#eb6834`, Robusta `#1baf7a`, Arabica `#eda100`.
- **Tree stages**: Newly planted `#2a78d6`, Growing `#eb6834`, Flowering `#1baf7a`, Fruiting `#eda100`, Damaged `#e87ba4`.
- **Single-series** charts use Roast `#7B4A2A`.
- Several of these are under 3:1 contrast on white, so charts always show a legend or direct labels **and** the table view.
- Status pills keep their tones: green = done / approved, amber = waiting, blue = in progress, roast = on the way, red = rejected, gray = closed.

### 8.4 Screen → route map (dashboard)
| Screen file(s) | Route | Roles |
|---|---|---|
| `OverviewFarmer` / `OverviewGM` / `OverviewKaluppa` | `/dashboard/overview` | farmer / group_manager / kaluppa |
| `AssociationModal` | window on `/dashboard/*` | farmer (no association, no pending request) |
| `FarmerAssociation` (Tweaks: approved / pending / rejected / none) | `/dashboard/account/association` | farmer |
| `FarmerAddresses` | `/dashboard/account/addresses` | farmer |
| `Buttons` | the `<Button>` component | all |
| `Farmers`, `FarmerReview`, `FarmerForm` | `/dashboard/farmers` | group_manager |
| `GroupManagers`, `GroupManagerForm` | `/dashboard/group-managers` | kaluppa |
| `Associations`, `AssociationForm` | `/dashboard/associations` | kaluppa |
| `Farms`, `FarmForm`, `FarmView` | `/dashboard/farms` | all three |
| `Trees`, `TreeForm` | `/dashboard/trees` | all three |
| `Harvests`, `HarvestForm` | `/dashboard/harvests` | all three |
| `Inbox`, `InboxMobile` | `/dashboard/inbox`, `/dashboard/inbox/:conversationId` | all three |
| `Hub` | `/dashboard/hub` (post page `/dashboard/hub/posts/:id`) | all three |
| `BeansFarmer`, `BeansSell` | `/dashboard/beans` | farmer, group_manager |
| `BeansKaluppa`, `BeansReview` | `/dashboard/beans` | kaluppa |
| `OrdersFarmer` | `/dashboard/orders` | farmer |
| `OrdersKaluppa`, `OrderManage` | `/dashboard/orders` | kaluppa |
| `Inventory`, `InventoryForm` | `/dashboard/inventory` | kaluppa |
| `Reviews`, `ReviewView` | `/dashboard/reviews` | kaluppa |
| `FarmMap` | `/dashboard/farm-map` | all three |
| `Reports` | `/dashboard/reports` | group_manager, kaluppa |
| `AuditLog` | `/dashboard/audit-log` | kaluppa |
| `SettingsKaluppa` | `/dashboard/settings` | kaluppa |
| `Main` (top-3 section), `Register` (farmer card copy), `PostDetail` (fixed media stage) | Phase 1 routes | updated |

`Dashboard.dc.html` (Phase 1 placeholder) is replaced; delete the placeholder page.

### 8.6 Phone and tablet (Change 06; boards `MobileOverview`, `MobileFarms`, `MobileFarmForm`, `MobileNav`)
- **Below 960px**: the sidebar hides; the top bar's menu button opens it as a 280px left drawer with a backdrop. The avatar's name and role hide.
- **Below 720px**:
  - **DataTable**: the toolbar stacks (full-width search; filters in a 2-column grid; "Clear filters" spans both columns); rows become cards (title, label/value rows, labeled action buttons); the footer stacks.
  - **Page header**: actions stretch; the date filter's segments are equal width.
  - **Drawers**: full width, body padding 20/18, every field grid one column, footer buttons stretch.
  - **No horizontal page scroll anywhere.**

### 8.8 Terms (Change 09)
- **Sign up**: the terms checkbox sits above Create account. The document names are underlined roast buttons. The error line is red 12.5 px with an icon, indented 28 px.
- **`TermsModal`**: 640 px; underline tabs 44 px tall; the body scrolls; footer buttons on the right. In accept mode there's a checkbox above the buttons and the primary button stays muted until it's ticked. Full screen on phones.

### 8.7 Layout rules to keep (Change 07)
- The dashboard top bar is sticky on every page.
- Inbox and Hub are full width (no 1240px cap). The Hub feed is 680px and centered, with a **sticky 340px aside**.
- Reports charts sit in a 2×2 grid.
- The Beans **Sell beans** button is disabled once an unapproved farmer reaches 5 kg (board `BeansLimit`).

### 8.8 Change 08 components
- **ConfirmChangesModal** (`FarmEditConfirm`): save icon, "Save these changes?", a list of `label: before → after` (struck-through red → green), the note about History, and Keep editing / Save changes. Used by every edit form.
- **ExportModal** (`ReportsExport`): two format radio cards (CSV green tag, PDF red tag) with a 2px roast border when picked, a "Uses what's on screen now" box with filter chips, and an Export CSV / PDF button.
- **Default password field**: read-only monospace input `KapeKonek@123` with Copy (create only). **Reset password box** in edit forms, with its confirm modal.
- **DataTable `product` cell**: a 44px thumbnail; with no photo, the **default image** (espresso radial gradient, caramel bean logo).
- **Association map**: MiniMap with Group Manager-colored pins for each active association; the picked one is ringed and its town shaded.
- **Mentions**: list under the textarea (32px avatar, name, role · association, first row highlighted). Mentions render as roast text on a crema chip.
- **Best sellers carousel** (`Main`): 4 / 2 / 1 per view, round prev / next buttons in the header, pill dots, "#N best seller" badge.
- **Contact us** (`ContactUs`): crema hero; form card on the left; espresso branch card, map and FAQ link on the right.

### 8.5 Interactions to rebuild (dashboard)
- **Tables**: search (debounced 300 ms), the Status dropdown, the filters and the page are synced to the URL query (`?status=&q=&variety=&page=`). Filter dropdowns have no search box. ↑ ↓ / Enter / Esc work on them. Row actions open drawers; drawers update the URL (`?open=<id>&mode=view|edit`) so links can be shared.
- **Farm form**: municipality → fly to it and move the pin; barangay → fly closer, move the pin and show the ring; a click or drag reverse-geocodes. Kaluppa sees "Managed by"; Group Managers see "Farmer".
- **Farm view drawer**: tabs Details / Trees / Harvests. Trees has an inline "Add tree group" form. Kaluppa farms show the assigned-farmer chips (only the assigned Group Manager can edit them).
- **Harvest form**: the variety dropdown is disabled until a farm is picked, then lists only that farm's varieties.
- **Beans**:
  - The form computes the total live. Above the cap, the weight field turns red, the hint explains why, and Send is disabled.
  - The Kaluppa drawer goes Approve / Reject (with reason) → "Beans arrived" → final weight and amount → Mark completed, and can Cancel sale (with reason).
- **Orders (Kaluppa)**: Confirm is disabled until "The receipt matches the total" is ticked for e-wallet orders. The next-step button follows the status. Rider fields show for out for delivery, the cash tick for COD, and the refund reference for cancelled e-wallet orders.
- **Inbox**: chat filters and search; switching chats; Enter sends and Shift+Enter adds a new line; reply preview; edit mode; delete menu; typing indicator; "Loading earlier messages" at the top.
- **Hub**: the trigger card opens the Create post modal (Photo / video opens it with the dropzone; Tags opens it with the tag picker); clicking media, the time, the counts or Comment opens the post viewer (prev / next, thumbnails, send a comment); tag chips (max 3; the rest disable); tag filter chips; the reaction picker; comments expand; reply inputs; the post menu (author: Edit / Delete; Kaluppa: Remove with reason).
- **Farm Map**: the filters narrow both the pins and the list; clicking a list item flies to the farm and opens its popover.
- **Reviews**: the drawer shows the reply card (Edit / Delete) or the reply form with a counter; Hide opens the reason modal; hidden reviews show a gray banner and a "Show again" button. On the product page (`ProductDetail.dc.html`), a review with a reply shows a crema "Reply from Kaluppa" box with a roast left border.
- **Inventory form**: clicking a photo tile makes it the thumbnail (2px roast border, ring and a "★ Thumbnail" badge); × removes a photo; + adds one (up to 5).
- **Settings**: the tabs; the weekday hour switches; the fee calculator updates live; the sticky save bar shows when something has changed.
