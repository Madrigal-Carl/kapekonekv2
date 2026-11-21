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
| `Input`, `Label`, `FieldHint`, `Select`, `Textarea` | Login, Register, Settings, Profile, Checkout | |
| `PasswordInput` + `PasswordRule` | Login, Register, ResetPassword, Settings | Eye toggle (aria-pressed). Rule line "At least 8 characters with a letter, a number and a special character" turns green with a check when valid. |
| `RadioCard` | Register (role), Checkout (method, address, payment), Modals (cancel reason) | Selected: 2px roast border + highlight background. |
| `ChipToggle` | Products (variety) | Selected: roast fill, white text, check icon. |
| `ProductCard` | Main, Products | 4:3 image, category label, name, short detail, rating, price / unit, Add button. Out-of-stock and "Only N left" badges. |
| `StarRating` (display, picker) | ProductDetail | Caramel fill. |
| `QuantityStepper` | ProductDetail, CartDrawer | Unit-aware step; disabled at min/max. |
| `CartDrawer` | CartDrawer | Right drawer 460px. Items, warnings, subtotal, **stacked full-width buttons: Checkout (primary) then Clear cart (outline)**. Checkout disabled (still labeled "Checkout") when any item is over stock. |
| `ConfirmDialog` | Modals | Icon tile, title, text, two buttons. Cancel-order variant with reason radio list + "Tell us more" (required for Other) + refund note. |
| `StatusPill`, `RefundBadge` | Orders, OrderDetail | |
| `OrderGroupTabs` + `StatusChips` | Orders | Six group cards (icon tile, count, label, hint): All orders, To confirm (pending), Preparing (reserved + processing), On the way (out for delivery + ready for pickup), Completed (sold), Closed (cancelled + rejected + expired). Active card: 2px roast border, highlight bg, roast icon tile. Groups with several statuses show status chips underneath (All · each status with its color dot); the active chip is espresso-filled. |
| `OrderCard` | Orders | Header band (number, date, pills), item table, footer (destination line + payment chip, total, View details). |
| `StatusTimeline` | OrderDetail | Done steps roast, current step teal, upcoming grey. |
| `AccountCard` | Profile, Settings, Addresses | Card with header band, body grid, footer band with actions. **No side menu** — account navigation lives in the avatar dropdown only. |
| `AuthLayout` | Login, Register, ForgotPassword, ResetPassword, VerifyEmail | Split: left brand panel (photo + espresso gradient + contour lines, logo, eyebrow, tagline) hidden under 900px; right swaps forms via `<Outlet />`. |
| `AddressCard` | Addresses, Checkout | Label, Default badge, recipient · phone, street, area, pin status; actions Edit / Set as default / Delete. In Checkout it's a radio card showing distance + fee. |
| `AddressFormModal` + `MapPicker` | AddressModal | Two columns. **Map**: search box, "Use my location", click/drag pin → `/geo/reverse` auto-fills fields, outside-area error. **Form**: label chips, recipient, phone, province (read-only), municipality and barangay selects, postal code (read-only), street/landmark, default checkbox, fee preview. Footer: Cancel / Save address. |
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
| `Addresses.dc.html` | `/addresses` | verified buyer |
| `AddressModal.dc.html` | modal over `/addresses` and `/checkout` | verified buyer |
| `Navbar.dc.html`, `Footer.dc.html` | shared | — |

## 6. Interactions to rebuild

- Landing FAQ accordion (one open at a time). Hero carousel with arrows, dots, "01 / 03", autoplay that pauses on hover/focus.
- Products: variety chips, coffee-type checkboxes, price range, sort, search — all synced to the URL query; infinite scroll with skeleton row and "Loading more coffee…".
- Product detail: thumbnail switching, unit-aware quantity stepper with live total, star picker, "Load more reviews".
- Cart: steppers, over-stock warning, Checkout disabled while any warning shows.
- Checkout: delivery/pickup cards switch section 2 (saved addresses vs Kaluppa pickup card + contact number); payment cards switch between e-wallet (GCash/Maya tabs, QR, receipt upload) and the cash note; the summary updates fee, total, destination, ETA and payment live.
- Addresses: set default, edit, delete (confirm), add (opens modal).
- Address modal: click/drag pin → fields fill; municipality select drives barangay options and postal code; outside-area pin shows the error.
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
