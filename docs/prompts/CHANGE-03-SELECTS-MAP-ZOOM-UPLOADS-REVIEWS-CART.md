# Change 03 — Search selects, address map zoom, upload limits, review rules, cart quantity fix

**When to run:** after M7, on the finished Phase 1 app. Run it in a fresh session (`/clear` first).

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and the whole `docs/` folder with an updated version. These decisions are final, so don't re-ask:

1. **Every select is a searchable dropdown.** Build one reusable `SearchSelect` with a custom leading icon and a custom chevron. No native `<select>` is left anywhere in the frontend.
2. **The login checkbox label is just "Remember me".** The behavior doesn't change: checked means a 30-day refresh cookie, unchecked means a session cookie.
3. **The address map zooms with the selects.**
   - Picking a municipality flies the map to that municipality.
   - Picking a barangay flies closer to that barangay.
4. **Upload limits:** images up to **5 MB**, any other file up to **10 MB**. Checked in the browser and again on the server.
5. **Review rules:**
   - Only someone with a completed (`sold`) order containing the product can review it, once per product.
   - The author can **edit** or **delete** their own review.
   - Buyers have this now. Farmers get the same permissions later through the seeder only.
6. **Bug: adding a quantity to the cart can go over stock.** Fix it on the server and in the UI.

## Read first

- `CLAUDE.md`: the new bullets under quantity, selects, uploads and reviews.
- `docs/PRODUCT-SPEC.md`:
  - §1, the `reviews.delete_own` permission and the farmer note;
  - §2 Review, eligibility and own maintenance;
  - §7 Uploads, Reviews, and Cart (including the **Quantity rule**);
  - §8 Address window, the zoom rules;
  - §9 Uploads, `UPLOAD_RULES`.
- `docs/DESIGN.md` §5 (`SearchSelect`, `FileDrop`, `ReviewPanel`, `QuantityStepper`, `AddressFormModal` + `MapPicker`) and §6.
- The screens in `docs/design/screens/`:
  - **new**: `SearchSelect.dc.html`, the component, and `Components.dc.html`, which shows every select, upload and review state;
  - **changed**: `AddressModal`, `Products` (sort), `Login`, `ProductDetail`, `CartDrawer`, `Checkout` (receipt hint) and `Profile` (avatar hint).

Use **superpowers** for the plan and TDD. Write the plan into `docs/plans/phase-1.md` under a new "Change 03" heading before you touch code.

## Work, in this order (one commit per part)

### Part A — Cart quantity bug (test first)
1. Reproduce it with a failing backend test.
   - A product with stock 3 already has 2 in the cart. `POST /cart/items` with quantity 2 must return `409 QUANTITY_EXCEEDS_STOCK` with `{stock: 3, inCart: 2, maxAddable: 1}`.
   - Also cover kg steps: stock 3 kg, 2.5 kg in cart, add 0.5 kg → OK; add 1 kg → 409.
   - Find the real cause, such as `POST` replacing instead of adding, checking only the added amount, float drift, or a missing check in `PATCH`, and write it in the plan.
2. Put one helper in the cart service, `assertQuantityAllowed(product, resultingQty)`. Use it in add, update and checkout validation.
   - Check the step with integer math (`Math.round(q * 2)` for kg).
   - Never clamp silently on the server.
3. `GET /cart` and the product detail response include `inCart` for the signed-in user, so the UI can compute `maxAddable = stock − inCart`.
4. In the UI:
   - `QuantityStepper` takes `max`. Product detail passes `stock − inCart`, shows "N already in your cart · you can add up to M more", and disables `+` at the cap with the hint from the screen. Add to cart is disabled when `maxAddable` is 0.
   - The Cart drawer caps at `stock` and shows "That is all we have: …".
   - A 409 from the server shows a toast with the server's numbers and refreshes the cart query.
   - The existing over-stock warning stays, for when stock dropped after adding.

### Part B — `SearchSelect` component, replacing every select
1. Create `frontend/src/components/ui/SearchSelect.jsx`, matching `SearchSelect.dc.html` and the states on `Components.dc.html`.
   - Props: `label?`, `options` (strings or `{value,label}`), `value`, `onChange`, `placeholder`, `searchPlaceholder`, `icon` (`pin|home|sort|tag|none`), `size` (`md|sm`), `searchable` (default true), `disabled`, `error`, `aria-label`, `name`, `id`.
   - It forwards a ref and works inside react-hook-form `Controller`.
   - Accessibility: a button trigger with `aria-haspopup="listbox"` and `aria-expanded`. The search input is a `combobox` with `aria-activedescendant`, and the options have `role="option"` with `aria-selected`.
   - Keyboard: ↑, ↓, Enter, Esc and Home/End. Outside click closes it, and focus goes back to the trigger after a pick.
   - The match is highlighted, a check marks the chosen option, there's a "No match for …" state and a footer with the count and key hints.
   - The popover flips upward when there isn't room below. Render it in a portal so modals don't clip it.
   - Use icons from the project's icon set. The chevron is a round 24px badge that rotates 180° and fills roast when open, as on the screen.
2. Search `frontend/src` for `<select` and for any other select-like component, and replace every one. That includes at least Products sort (`size="sm"`, `icon="sort"`, no visible label, so give it an `aria-label`) and the address municipality/barangay selects. List each replacement in the plan.
3. Add unit tests (Vitest + Testing Library): filtering, keyboard selection, Esc closes, disabled, error message, and RHF integration.

### Part C — Address map zoom
1. Add `MUNICIPALITY_CENTERS` to the shared locations constant (town centers; use the coordinates in `AddressModal.dc.html` `TOWNS` and refine them if `/locations` already has better ones).
2. Municipality change:
   - `map.flyTo({center, zoom: 12.5})`;
   - move the pin to the center;
   - clear the barangay;
   - fill the postal code.
3. Barangay change:
   - Resolve the barangay with the existing `GET /geo/search` (query `"<barangay>, <municipality>, Marinduque, Philippines"`, Marinduque bbox, proximity set to the municipality center).
   - `flyTo({zoom: 15})` and move the pin.
   - Cache it with TanStack (`staleTime: Infinity`) and on the backend in Valkey (7 days, key `geo:brgy:<muni>:<brgy>`).
   - If nothing is found, stay at the municipality zoom and show the hint "Couldn't find that barangay on the map. Drag the pin to your spot."
4. Pin moves from the selects carry `source: 'select'` and **must not** call `/geo/reverse` or overwrite the fields. Manual drag/click, search and "Use my location" still reverse-geocode as before.
5. Match the rest of the screen:
   - a new address starts at the whole-island view with no pin, and the barangay select is disabled until there's a municipality;
   - Mapbox `NavigationControl` plus a "fit Marinduque" button;
   - a zoom label at the bottom left;
   - a dashed approximate-area ring at barangay zoom;
   - the fee preview placeholder before a pin exists.
   - For edit mode, open at barangay zoom on the saved pin.
6. Respect `prefers-reduced-motion`: use `jumpTo` instead of `flyTo`.

### Part D — Upload limits
1. Put `UPLOAD_RULES` in `schemas/rules.js` and mirror it in the backend config:
   - `image`: jpg/png/webp/heic, 5 MB;
   - `file`: pdf/mp4/webm, 10 MB.
   Add a helper that maps a purpose to its kind (`avatar` and `receipt` are `image`; the seeder-only `product`/`post` media follow the same rule by type).
2. `POST /uploads/signature` takes `{purpose}`, signs `allowed_formats` and the folder, and returns the max bytes for the client.
3. When a `publicId` comes back (avatar save, order create), check it with the Cloudinary Admin API (`resource`: `bytes`, `format`, `resource_type`). If it's over the limit or the wrong type, destroy the asset and return `422 FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED`.
4. Build a shared `FileDrop` (with `kind`) that checks type and size before uploading and shows the too-large state from `Components.dc.html`, with copy like "receipt.png is 7.2 MB. Images can be up to 5 MB."
   - Use it for the checkout receipt and the profile avatar. The avatar limit goes from 2 MB to 5 MB.
   - Update the hint text to match the screens.
5. Tests: the Zod rule at 5 MB and 5 MB + 1 byte for an image and at 10 MB for a file, the signature payload, and the server-side reject path (mock Cloudinary).

### Part E — Review rules and own maintenance
1. Permissions: add `reviews.delete_own`. Buyer and kaluppa get `reviews.create`, `reviews.update_own` and `reviews.delete_own`. Leave `farmer` without them, but add a comment in the seeder that it gets them when the farmer shop ships.
   - Re-run the role seeder and clear the `perm:user:*` cache.
2. Eligibility service: `canReview(userId, productId)` returns `{canReview, reason, order, pendingOrderNumber}`.
   - It needs an order with `status: 'sold'` whose items include the product.
   - It returns `already_reviewed` if a review exists.
   - It checks permissions plus eligibility, never `role === 'buyer'`.
3. Endpoints, per PRODUCT-SPEC §7:
   - `GET /products/:id/reviews/me`;
   - `POST` (`403 REVIEW_NOT_ALLOWED` / `409 ALREADY_REVIEWED`);
   - `PATCH /reviews/:id` (author only; sets `editedAt`);
   - `DELETE /reviews/:id` (author only, hard delete).
   - Someone else's review id returns `404`.
   - Every write recomputes `ratingAverage` / `ratingCount` on the product.
4. UI: build a `ReviewPanel` with every state from `ProductDetail.dc.html` and `Components.dc.html`:
   - guest;
   - not purchased;
   - ordered but not completed (links the order);
   - write;
   - your review (stars, text, Posted/Edited stamp, Edit and Delete with an inline confirm);
   - the edit form with Cancel / Save changes.
   - After a delete it goes back to "Write a review".
   - Invalidate the reviews list, the summary and the product queries after each write.
   - The list badge now reads **"Verified purchase"**.
5. Tests for create/update/delete authorization, eligibility reasons and rating recompute.

### Part F — Small copy change
- In Login, the checkbox label becomes "Remember me". The cookie behavior is unchanged.
- Search for other "30 days" copy tied to that checkbox and update it.

## Verify, then commit
- `npm run lint` and `npm test` pass in both apps. `npm run migrate:fresh -- --seed` works, and the seeded reviews still come from buyers with sold orders.
- Use **playwright** at 1440px and 390px, comparing with the screens:
  - Address modal: pick a municipality, then a barangay, and check that the map zooms each time and the fields don't get overwritten.
  - Products sort.
  - Product detail: the stepper cap, and your review → edit → delete → write.
  - Cart drawer cap.
  - Checkout: a 6 MB receipt is rejected before upload.
  - Login label.
- `grep -rn "<select" frontend/src` returns nothing.
- Update `docs/plans/phase-1.md` (Change 03 log, with the cart bug's real cause), then make the commits: `Change 03A: …` through `Change 03F: …`. Stop when done and report what changed.

## Done when
- [ ] No native select remains; every one is `SearchSelect`, with search and the custom icons.
- [ ] The login label reads "Remember me" and the 30-day/session behavior is unchanged.
- [ ] Municipality → zoom to the municipality, barangay → zoom closer, and the fields aren't overwritten by those moves.
- [ ] Images over 5 MB and files over 10 MB are refused in the browser and on the server.
- [ ] Only users with a sold order for the product can review, once. Authors can edit and delete their own; nobody else can.
- [ ] The cart can never hold more than stock through add or update, and the UI caps steppers at what's addable.
- [ ] Lint, tests and Playwright checks green; committed.
