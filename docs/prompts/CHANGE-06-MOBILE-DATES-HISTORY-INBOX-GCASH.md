# Change 06 — Phone layouts, overview date filter, history in drawers, fidelity fixes, GCash only

**When to run:** after Phase 2 **M11** is committed, **before M12**, in a fresh session (`/clear` first). Then continue with M12.

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with an updated kit. These decisions are final; don't re-ask. Add a "Change 06" section to `docs/plans/phase-2.md` (superpowers), then make **one commit per part**.

## Read first
- `docs/DESIGN.md` §8.6 (phone rules), §8.2 (History, DataTable cards, segmented date filter), §8.5.
- `docs/PHASE-2-SPEC.md` §3.14 (date filter), §3.15 (record history), §3.16 (payment providers).
- The screens:
  - **new**: `MobileOverview`, `MobileFarms`, `MobileFarmForm`, `MobileNav` (all 390px wide);
  - **changed**: `DataTable`, `DashTopbar`, the three `Overview*`, every page with a view or edit drawer, `Inventory` / `InventoryForm`, `Inbox` / `InboxMobile`, `SettingsKaluppa`, `Main`, `Checkout`, `CartDrawer`, `ProductDetail`, `Orders`.

## Part A — Phone and tablet responsiveness (every dashboard page)
The rules are in DESIGN §8.6; the boards show them at 390px.
- **Sidebar**:
  - Below 960px the sidebar hides and the top bar's menu button opens it as a **left drawer** (280px; backdrop; Esc and backdrop close it; focus is trapped; it closes when you navigate).
  - The avatar name and role hide; the avatar stays.
- **DataTable** below 720px:
  - The toolbar stacks: full-width search, then the filter dropdowns in a **2-column grid** (each fills its cell; "Clear filters" spans the row).
  - Rows become **cards**:
    - the first column is the card title (with an avatar for person cells);
    - the other columns are label/value rows, values right-aligned, pills kept;
    - the row actions become labeled buttons along the bottom.
  - The footer stacks: the range text, then centered page buttons.
  - Never let the table scroll sideways on a phone.
- **Page header**: actions wrap and stretch to full width. The overview date filter stretches, with 4 equal segments.
- **Drawers**:
  - full width below 720px; body padding 20/18;
  - every 2- and 3-column field grid becomes one column;
  - footer buttons stretch.
  - Modals are `calc(100% - 32px)` wide.
- **Maps** keep their aspect ratio and never overflow. Inbox follows `InboxMobile`.
- **Check**: a Playwright pass at **390px and 768px** over every dashboard route for each role. Zero horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), no clipped dropdowns, drawers usable.

## Part B — Overview date filter (and make the overviews fully live)
- Add the segmented filter **Today · This week · This month (default) · This year** above the KPI tiles on all three overviews.
  - Next to it: "Showing this month · Nov 1 – Nov 30, 2026".
  - Synced to the URL (`?period=`) and remembered per user (localStorage, wrapped in try/catch).
- **Backend**: `GET /dashboard/overview?period=today|week|month|year` (scoped by role).
  - Periods are calendar ranges in **Asia/Manila**; weeks start on Monday.
  - Return the KPI values, the comparison with the previous equivalent period ("▲ 12% vs October"), and the chart buckets:
    - today: 2-hour buckets from 6 AM;
    - week: days;
    - month: weeks;
    - year: months.
- Stock-like KPIs (farms, trees, orders to confirm, listings to review) are "as of now" and ignore the period. Make sure every KPI, chart and list on the overviews comes from real data; no placeholders.
- Tests: the period boundaries (timezone, week start), scoping per role, and the comparison maths.

## Part C — History in every view drawer
- Add a **History** section at the end of every view drawer, and of edit drawers when editing an existing record (`HISTORY` in the screens):
  - Farmers (view and review), Group Managers, Associations;
  - Farm (a new **History** tab next to Details / Trees / Harvests), Tree and Harvest edit drawers;
  - Beans (farmer view and Kaluppa review), Orders (farmer view and Kaluppa manage; the order status timeline stays and is now titled **Status**);
  - Inventory edit, Reviews.
- **Each entry**: actor avatar (photo or initials), "**Name** did what", the time, and changed fields as `field before → after`. Newest first. Show 5, then "Show older".
- **API**: `GET /audit-logs/entity/:entityType/:entityId?cursor`. Anyone who can view the record can read its history. Only Kaluppa sees "Open in audit log" (a link to `/dashboard/audit-log?entity=<id>`).
- Make sure every service writes the audit entries these sections need. Check the list in PHASE-2-SPEC §3.15.

## Part D — Inventory thumbnail picker (fix overflow)
- Remove the "Thumbnail" text badge.
- Each photo tile gets a **26px round star button** in the top-left corner:
  - outline star on white (92%) for normal photos;
  - filled white star on roast for the thumbnail.
  - `aria-pressed` and `aria-label` ("Make photo 2 the thumbnail" / "Photo 2 is the thumbnail").
- The thumbnail tile keeps the 2px roast border and ring. The × stays top-right. Nothing may overflow the tile at any width (5 tiles in a row in a 620px drawer; 3 per row on phones).

## Part E — Fix the pages that don't match their screens
1. **Kaluppa Settings** (`SettingsKaluppa.dc.html`). Measure and match:
   - Page: `main` padding 28/32, gap 20 between blocks.
   - Tab bar: underline style, 44px tall, 14px side padding, 14px text, active 600 weight with a 2px roast underline.
   - Branch tab: two cards side by side (`flex: 1 1 420px`, gap 16), each with padding **22px** and **14px** between fields, title 16/600, helper text 12.5px. Inputs 44px; 2-column grids gap 20; the hours list has 6px row gap with 40×22 switches.
   - Map card: map 600:440, radius 8.
   - Fee tab: the 2-column grid of inputs plus the "Try it" card (22px padding, result box 14px padding on crema).
   - E-wallet tab: the note box (12/14 padding), cards in a grid with 16px gap, padding 22, QR column 160px.
   - Sticky save bar: padding 14/18, radius 8, top shadow.
   - Compare at 1440px and 390px with a screenshot diff. List each spacing you changed in the plan.
2. **Inbox** (`Inbox.dc.html`, `InboxMobile.dc.html`). Rebuild it to match:
   - **Panel**: 760px tall, radius 10, list column 340px wide.
   - **List header**: padding 14/14/10, "Chats" title 18/600, a 38px round new-message button.
   - **Search input**: 40px tall, **radius 5px** (not pill), sand border, white background, 34px left padding for the icon, text 13.5px. The same look as the DataTable search.
   - **Filter chips**: 32px, pill. **List rows**: padding 11/14, 44px avatar, 3px left bar on the active chat.
   - **Thread header**: padding 12/16, 40px avatar.
   - **Messages area**: padding 16/20, gap 12.
   - **Bubbles**: padding 9/13, 13.5px text; mine are roast with radius 14/14/4/14, theirs white with a sand border and radius 14/14/14/4.
   - **Composer**: padding 10/14/14, attach button, textarea **radius 5px**, min height 42; send button 42×42 with **radius 5px**.
   - **Avatars everywhere in the Inbox**: chat list, thread header, group message authors, "Seen by" chips. Show the user's **profile photo** when they have one (`object-fit: cover`, round, or 12px radius for groups and the Kaluppa chat). Otherwise show their initials on their color. Seed a few users with avatars.
   - **Message menu**: "…" opens a menu **directly below the button**, right-aligned to it (Edit within 15 min, Delete for everyone, Delete for me). While it's open, the hover actions stay visible and the "…" button shows a pressed background. Esc and outside clicks close it; it flips upward only when there isn't room below.

## Part F — Copy and payments
- **Landing**: remove the note under "How ordering works" ("Kaluppa confirms each order within 3 days. If it isn't confirmed in time, it expires, and any e-wallet payment is refunded."). The 3-day expiry rule itself stays.
- **GCash only, for now**:
  - Payment providers come from Settings → E-wallet. Each provider has `showAtCheckout`.
  - **Seed**: GCash on, Maya saved but **off**. Keep the Maya account details.
- Generate all copy from the enabled providers ("Pay by GCash or cash on delivery"): hero text, "How ordering works" step 3, the FAQ answer "How do I pay?", the product page notes, the cart drawer note, checkout (only GCash; if only one provider is enabled, hide the wallet tabs), order emails, and Kaluppa's Settings note.
- Never hard-code "GCash, Maya". Turning Maya back on in Settings must make it appear everywhere without code changes. Write a test for that.

## Verify, then commit
- Lint and tests pass; `npm run migrate:fresh -- --seed` works.
- The Playwright phone pass from Part A.
- Overviews in all 4 periods for each role.
- History visible in each listed drawer.
- The inventory star picker at 620px and 390px.
- Settings and Inbox compared with their screens.
- No "Maya" visible anywhere while it's off.
- Log Change 06 in the plan. Commit parts A–F (`Change 06A: …` through `Change 06F: …`), then stop so the user can start M12.
