# Change 05 — react-icons, one Button, area highlights, username suggestions, farmer account pages

**When to run:** after Phase 2 **M10** is committed, **before M11**, in a fresh session (`/clear` first). Then continue with M11.

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with an updated kit. These decisions are final; don't re-ask. Use **superpowers** to add a "Change 05" section to `docs/plans/phase-2.md` before coding, and make **one commit per part**.

## Read first
- `CLAUDE.md`, UI rules: icons and buttons.
- `docs/DESIGN.md` §8.2, the rows for **Button**, **Icons**, **MapPicker** and the **Account pages**.
- `docs/PHASE-2-SPEC.md` §3.1, §3.6 and §5 (boundaries endpoint, address labels).
- The screens:
  - **new**: `Buttons.dc.html`, `FarmerAddresses.dc.html`;
  - **changed**: `FarmerAssociation.dc.html` (redesigned; Tweaks `status` = approved / pending / rejected / none), `MiniMap.dc.html` and `AddressModal.dc.html` (area highlight), `Farms.dc.html` / `FarmForm.dc.html` / `FarmView.dc.html`, `FarmMap.dc.html`, `SettingsKaluppa.dc.html`, `Farmers.dc.html` / `FarmerForm.dc.html`, `GroupManagers.dc.html` / `GroupManagerForm.dc.html`, `DashTopbar.dc.html`.

## Part A — Icons: `react-icons` only
1. Install `react-icons`. Use the **Lucide set (`react-icons/lu`)**; the screens are drawn from Lucide shapes, so the look stays the same.
2. Create `frontend/src/components/ui/icons.js`, one place that re-exports every icon the app uses under app names (`IconFarm = LuSprout`, `IconTree`, `IconHarvest = LuWheat`, `IconBeans = LuBean`, `IconInbox = LuMessageSquare`, `IconHub = LuNewspaper`, `IconMap`, `IconReports = LuChartColumn`, `IconAudit = LuHistory`, `IconSettings = LuSlidersHorizontal`, `IconHide = LuMessageSquareOff`, `IconShow = LuMessageSquareCheck`, and so on).
   - If a name doesn't exist in your installed version, pick the closest Lucide icon and note it in the plan.
3. Replace **every** inline `<svg>` icon and any other icon library (for example `lucide-react` or `@heroicons`) in both the storefront and the dashboard.
   - **Keep as custom SVG:** the KapeKonek coffee-bean logo mark, the three reaction badges (like / love / celebrate) and the map pins.
   - Remove the old icon package from `package.json`.
4. Icons are decorative by default (`aria-hidden`). Icon-only buttons must have an `aria-label`. Sizes: 14 / 16 / 18 / 20.
5. **Check:** `grep -rn "<svg" frontend/src` returns only the allowed custom files.

## Part B — One `<Button>` component
1. Build `frontend/src/components/ui/Button.jsx` exactly as `Buttons.dc.html` shows.
   - `variant`: `solid` (default) | `outline` | `soft` | `ghost` | `danger` | `danger-outline` | `success` | `link` | `light` | `glass` | `caramel`.
   - `size`: `sm` 36px | `md` 42px (default) | `lg` 48px.
   - Also `leftIcon`, `rightIcon`, `iconOnly` (square; requires `aria-label`), `loading` (spinner plus a loading label; the button keeps its width; disabled while loading), `disabled`, `fullWidth`, and `as` (`button` | `Link` | `a`, so links can look like buttons).
   - Hover, focus and disabled states as on the board. Radius 5, weight 600, gap 8.
2. Replace every `<button>` and button-styled `<a>`/`<Link>` in the app with it (auth pages, storefront, cart, checkout, modals, drawers, tables, inbox, hub). Table row icon actions use `iconOnly` + `ghost` + `sm`.
3. Add a small lint guard: an ESLint `no-restricted-syntax` rule or a test that fails on a raw `<button` outside `components/ui/`.
4. Vitest: renders each variant and size, `loading` disables and shows the spinner, `as={Link}` works, and `iconOnly` without `aria-label` warns in dev.

## Part C — Highlight the real area on the map
1. **Boundary data**:
   - Use `faeldon/philippines-json-maps` (PSGC, Dec 2023; GeoJSON at municipality and barangay level). **Read its license and attribution in the repo first** and add the attribution to the README and the map's attribution control.
   - If its license doesn't allow this use, use the source shapefiles it names (`altcoder/philippines-psgc-shapefiles`), or OCHA/HDX COD-AB, and note the choice.
   - Extract **Marinduque only**: 6 municipalities and **218 barangays**. Simplify with mapshaper so each file is ≤ 300 KB.
   - Store them as `backend/src/data/boundaries/marinduque-municipalities.geojson` and `marinduque-barangays.geojson`, with properties `{psgc, municipality, barangay}`.
   - Write a test that every name in our `marinduque-locations.json` matches exactly one feature. Add a small alias map for spelling differences such as "Pob." and "Kiñaman".
2. **API**:
   - `GET /locations/boundaries?level=municipality` and `GET /locations/boundaries?level=barangay&municipality=<name>`. They're public, with `Cache-Control: public, max-age=604800` and an ETag.
   - Use the polygons on the server too:
     - `/geo/reverse` decides municipality and barangay by **point-in-polygon** (more reliable than matching names), keeping Mapbox only for the street;
     - the "outside Marinduque" check uses the island union.
3. **`MapPicker`**, used by buyer addresses, farm form, farm view, branch settings and Farm Map:
   - A GeoJSON source with a `fill` and a `line` layer for each level, filtered by the selected feature id.
   - **Municipality selected**: fill `rgba(200,145,58,0.16)` and a 2px line `#C8913A`; `fitBounds` to that municipality (padding 40) instead of a fixed zoom.
   - **Barangay selected**: fill `rgba(123,74,42,0.24)` and a 2px line `#7B4A2A`, with its municipality's outline kept. `fitBounds` to the barangay, and move the pin to the barangay's **pole of inaccessibility** (use `polylabel`) instead of calling `/geo/search`. This removes the barangay geocoding fallback from Change 03.
   - A manual pin drop highlights the municipality and barangay it falls in.
   - Respect `prefers-reduced-motion`.
   - The bottom-left label says "<Municipality> · municipality highlighted" or "<Barangay>, <Municipality> · barangay highlighted".
4. **Farm Map**: the municipality filter highlights and fits that municipality. Selecting a farm (pin or list) highlights its barangay.
5. **Tests**: the endpoint shapes, the point-in-polygon reverse (a pin in Pantayin returns Santa Cruz / Pantayin), and a Playwright check that picking Boac draws the highlighted area.

## Part D — Username suggestions when creating accounts
- Reuse the sign-up username component and endpoints from Phase 1 (the availability check plus 3 suggestions in one line) in **Add farmer** (Group Manager) and **Add Group Manager** (Kaluppa), and in their edit drawers.
  - Layout: `@` prefix; a status line (✓ available / ✕ taken or invalid / a hint when empty); "Suggestions:" followed by 3 chips on one line built from first and last name. Clicking a chip fills the field.
  - Suggestions update when the name changes.
  - Saving is blocked while the username is taken or invalid. The server re-checks uniqueness and returns `409 USERNAME_TAKEN`.
- See `FarmerForm.dc.html` and `GroupManagerForm.dc.html`.

## Part E — Farmer account pages (redesign)
- **Shared account nav** (`ACCOUNT_NAV` in the screens): a white pill bar with icon and label (Profile · Security · Association · Addresses). The active item uses a crema background and an espresso label. It sits under the page header on `/dashboard/account/*` (farmers; Group Managers and Kaluppa get Profile · Security).
- **Association** (`/dashboard/account/association`, `FarmerAssociation.dc.html`). Build all 4 states:
  - **approved**:
    - hero card: association tile, status badge, name, meta, Group chat button, a 4-cell stats strip;
    - "Your Group Manager" card (contact details, meeting info, Message);
    - "Request history" timeline;
    - Documents with fixed 4:3 previews (contain on dark), status chips, View / Replace;
    - "Move to another association": 3 steps on the left, the form or pending-transfer card on the right.
  - **pending**: amber badge; stats show the cap left, request date, reviewer, usual wait; the timeline shows the current step; "Withdraw request" (confirm modal).
  - **rejected**: red badge plus the reason alert; the land document chip says "Replace this"; the timeline ends with "Send it again".
  - **none**: an empty state with the cap note and the inline join form (association dropdown, two document tiles, Send request). This is the same flow as the sign-in window.
- **Addresses** (`/dashboard/account/addresses`, `FarmerAddresses.dc.html`):
  - "3 of 10 saved".
  - A 2-column grid of cards. Each has a **map preview** on the left (static MapPicker showing the pin and the barangay highlight), or a striped "No pin yet · Drop a pin" panel.
  - On the right:
    - the label chip with its icon, and Default (the default card gets a 2px roast border);
    - the recipient and phone, the two address lines;
    - distance and delivery fee from the branch;
    - Edit / Set as default / Delete (confirm).
  - A dashed "Add a new address" tile opens the address window.
  - Farmers get an extra label chip **Farm** (Home · Work · Farm · Other) in the address window.
- The avatar menu's **Addresses** item goes to this page for farmers (`DashTopbar.dc.html`).

## Verify, then commit
- `npm run lint` and `npm test` pass in both apps. `npm run migrate:fresh -- --seed` works.
- Playwright at 1440px and 390px:
  - Buttons on 5 sample pages match the board.
  - No inline icons remain.
  - Address window and farm form: picking Boac, then Mainit, highlights each area and fits the map.
  - Farm Map municipality filter highlight.
  - Add Group Manager: taken username → pick a suggestion → save.
  - Farmer Association page in all 4 states (use the seed farmers).
  - Farmer Addresses page.
- Update the plan log. Commit parts A–E (`Change 05A: …` through `Change 05E: …`), then stop so the user can start M11.
