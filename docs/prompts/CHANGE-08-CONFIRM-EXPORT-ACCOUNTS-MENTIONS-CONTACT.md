# Change 08 — Confirmations, CSV/PDF export, default passwords, verified accounts, Farms and Inventory rules, association map, Hub mentions, best sellers, Contact us

**When to run:** after Change 07 is committed, in a fresh session (`/clear` first). Then continue with the next milestone.

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with an updated kit. These decisions are final; don't re-ask. Add a "Change 08" section to `docs/plans/phase-2.md` (superpowers), then make **one commit per part**. If a part touches a page that isn't built yet, build that page this way when its milestone comes, and note it in the plan.

## Read first
- `docs/PHASE-2-SPEC.md` §3.17 (Change 08), and the updated §3.2, §3.6, §3.7, §3.10, §3.12, §4, §8.
- `docs/DESIGN.md` §8.8.
- **New screens**:
  - `InboxDeleteConfirm`, `ReportsExport`, `GroupManagerCreate`, `GroupManagerReset`, `FarmerCreate`, `FarmEditConfirm`, `InventoryLowStock`, `HubMention`, `VerifyEmailCreated`;
  - `ContactUs`, `ContactUsErrors`.
- **Changed screens**: `DataTable`, `Farmers`, `GroupManagers`, `Farms`, `Inventory`, `Reports`, `AuditLog`, `OrdersKaluppa`, `AssociationModal`, `FarmerAssociation`, `Hub`, `Inbox`, `Main`, `Navbar`, `Footer`, `VerifyEmail`, `SettingsKaluppa`.

## Part A — Confirmations
1. **"Save these changes?" — global.**
   - Every edit form for an existing record opens this confirm modal before saving: Farmers, Group Managers, Associations, Farms, Trees, Harvests, Inventory, Beans, Settings, profile and addresses. Creating something new doesn't ask.
   - Build one `ConfirmChangesModal`, fed by a `useDirtyDiff(initial, current, labels)` hook. The modal lists each changed field as **label: before → after**, then "This is recorded in the History and the audit log." The buttons are **Keep editing** and **Save changes**.
   - If nothing changed, Save stays disabled ("No changes yet").
   - Use the field labels from the form, not the API keys. Sensitive values (passwords) show as "changed", never as text.
2. **"Delete message?" in the Inbox.**
   - Both **Delete for everyone** and **Delete for me** open a confirm modal first, with its own text and a red button named after the action. Nothing is deleted until it's confirmed.
   - Esc and Cancel keep the message.

## Part B — Export as CSV or PDF (follows the current filters)
- Every Export button opens an **Export modal**: Reports (whole report, and the "By association" / "By farmer" table), Orders (Kaluppa) and the Audit log.
  - **Choose a format**: two radio cards, **CSV** ("Rows of data for Excel or Google Sheets") and **PDF** ("A formatted report with the totals, charts and tables, ready to print or share").
  - **"Uses what's on screen now"**: chips for the active filters (Reports: Period, Association), or the note that the table's search, status and filters apply.
  - The button reads **Export CSV** or **Export PDF**. A toast says it's downloading.
- **The export uses exactly the current filters.** The page sends the same query it uses for the screen (period, association, search, status, other filters, sort). The server re-checks scope: a Group Manager can only export their association.
- **PDF**:
  - generate it on the server (e.g. `pdfkit`, or Playwright's `page.pdf()` on a print route) with the KapeKonek header, filter summary, generated-at time (Asia/Manila), the KPI tiles, charts drawn as SVG, and the table;
  - A4, page numbers;
  - `Content-Disposition` file name like `kapekonek-report-2026-11-27.pdf`.
- **CSV**: UTF-8 with a BOM so Excel shows "₱" correctly; same columns as the screen.
- **API**: `GET /reports/export?format=csv|pdf&scope=all|table&period&association`, `GET /orders/export?format&…filters`, `GET /audit-logs/export?format&…filters`. Rate-limit them (5 per minute per user) and audit each export.

## Part C — Accounts: default password, reset, verified email first
1. **Create forms** (Kaluppa → Group Manager; Group Manager → farmer):
   - **Email is now required.**
   - Add a **read-only Password field** showing `KapeKonek@123`, with a Copy button and the hint "Every new account starts with this default password…". It appears only when creating.
   - Remove the old temporary-password modal and invite-link flow.
2. **Reset password** (edit forms only): Kaluppa editing a Group Manager, and a Group Manager editing a farmer.
   - A "Password" box with **Reset password** opens a confirm modal: "Reset {name}'s password?" It warns that the password goes back to `KapeKonek@123`, they're signed out everywhere (revoke refresh tokens and bump `tokenVersion`), and they get an email.
   - Permissions: `users.reset_password` (Kaluppa → Group Managers) and `farmers.reset_password` (a Group Manager → farmers in their own association only).
   - Audit it. Never show or log the password anywhere but this fixed default.
3. **Verify email first** (`VerifyEmailCreated`):
   - Accounts made by Kaluppa or a Group Manager start with `emailVerifiedAt: null` and get a verification email.
   - Until they verify, every sign-in lands on the **Verify email** page in its "created" variant: who created the account, the email it was sent to, Resend (60 s cooldown), Log out, and "Contact Kaluppa". The dashboard routes stay blocked (`requireVerified`).
   - After verifying, they reach their dashboard. A small banner suggests changing the default password in Settings → Security.
   - Existing username-only farmers get "Add your email" on that page, then verify.
4. **Seeds**: replace `farmer.nomail` with `farmer.unverified` (created by a Group Manager, email not verified), and add `manager.unverified`.

## Part D — Farms and Farmers
- **Remove the lot number completely**: model field, unique index, forms, columns, search, popovers, exports and seeds. Add a migration that drops `lotNumber` and its index.
  - The **property number is automatic and isn't shown as an input** in Add or Edit. The form shows a note ("made automatically when you save"), and edit shows it read-only in the note and the title.
  - Elsewhere a farm is named by its property number, plus "barangay, municipality" where a second line helps.
- **Size**: at most **2 decimal places** (`0.01–500`, `step 0.01`; Zod refine `Number.isInteger(v * 100)`); always shown with 2 decimals ("1.25 ha").
- **Farms table**: default sort **property number, ascending** (server default `sort=propertyNumber`), with an up arrow and `aria-sort="ascending"` on that header.
- **Farmers page** (Kaluppa and Group Manager): add a **Farms owned** column. It shows the first property number, then "+N more · owner", or "No farms yet".

## Part E — Inventory and the storefront
1. **Category Seedlings → Beans**. Rename the category (slug `beans`) with a migration. It keeps `catalog.farm_supplies`, so farmers buy it and buyers don't see it. Units are kg and sack. Update the seeds (e.g. Liberica dried cherry, Robusta parchment), filters, copy and emails.
2. **No "Featured" anymore**:
   - Remove the switch, the column and the `featured` flag (migration).
   - The landing **Best sellers** shows the **top 8 products by quantity in completed orders over the last 90 days**, only from categories the viewer may buy (guests: Coffee). If there aren't 8, newest active products fill the gaps.
   - A BullMQ job refreshes it daily and caches it in Valkey (`products:best8`). The hero uses the top 3.
3. **Best sellers carousel** (`Main`): 8 cards, each with a "#1 best seller" badge and "· 940 sold". It shows 4 per view on desktop, 2 on tablet and 1 on phones. Prev / next buttons, dots, swipe on touch, and keyboard support (arrows when focused). Respect `prefers-reduced-motion`. No autoplay.
4. **Default product image**:
   - A Kaluppa product with no photo shows the **KapeKonek default image**: espresso background with the caramel bean logo. Build it as a `ProductImage` component with a `fallback`, and use it everywhere a product image shows (Inventory rows, product cards, product page, cart, checkout, orders, emails).
   - The Inventory form explains this when there are no photos.
5. **Low-stock validation**: when **adding** a product, the starting stock must be **more than the low-stock level (10)**. Otherwise show the error "Starting stock must be more than 10, the low-stock level." and disable Add. The server enforces the same rule. Editing an existing product's stock is unaffected.

## Part F — Association map, chatting while pending, Hub mentions
1. **Association map** (`AssociationModal` and Account settings → Association, `FarmerAssociation`): under the association picker, a map shows **pins for every active association**, at its meeting point or the centroid of its town.
   - Picking a pin selects that association in the picker (and the reverse), and highlights its municipality.
   - Store a `location` (GeoJSON Point) on Association: Kaluppa sets it in the Association form with a pin. Seed it.
2. **Chat while pending**: a farmer whose request is pending can message the Group Manager of the association they asked to join. Create that direct chat when the request is sent; show "Message Liza" on the pending card.
   - If the request is rejected or withdrawn, the chat stays readable but read-only.
   - The farmer joins the association group chat only once approved.
3. **Hub @mentions** (`HubMention`): typing `@` in a post or comment opens a list of people you may mention, filtered as you type. ↑ ↓ Enter work, and Esc closes the list. A picked name is inserted as `@Full Name` and stored as `mentions[]` (user ids) on the post or comment.
   - **Kaluppa** can mention any farmer or Group Manager.
   - **A Group Manager** can mention Kaluppa and farmers in their association.
   - **A farmer** can mention Kaluppa, their association's Group Manager, and farmers in the same association.
   - The server re-checks the rules and drops any mention that isn't allowed.
   - Mentions render as highlighted links (role and association in the tooltip). Each mentioned person gets an in-app notification (and an email if they opted in).
   - There's also an **@** button in the Create post modal's "Add to your post" bar.

## Part G — Contact us and the address book
1. **Contact us** (`ContactUs`, `ContactUsErrors`): add "Contact us" to the navbar (`/contact`, with the active underline) and the footer.
   - **Form**: name, email, optional phone, Topic (An order / Delivery or pickup / Payment / Selling as a farmer / Partnership or bulk order / Something else), an Order number field when the topic is an order, and a message of 10–1,000 characters with a counter. Signed-in users get their name and email prefilled. Show inline errors and a summary.
   - **On send**: save a `ContactMessage`, email it to the **Contact email in Settings → Branch** (new field) via Brevo, and email a copy to the sender. Then show the "Message sent" state.
   - Protect it with a honeypot field and a rate limit (3 per hour per IP or email).
   - **Right column**: the branch name, address, phone (`tel:`), email (`mailto:`), opening hours from Settings, a map with the Kaluppa pin, and "Get directions".
   - Kaluppa sees the messages in the Inbox as a "Contact form" thread, or in a simple list. Pick the smaller change and note which.
2. **Address book in two tabs** (the original's behaviour):
   - **Atomic 10-address limit.** Add with a single conditional update: `updateOne({ _id: userId, 'addresses.9': { $exists: false } }, { $push: … })`. If nothing matched, return `409` "You can have up to 10 addresses."
   - **Version check.** Each change sends the address book version it started from (`If-Match` header with `addressesVersion`). The server updates only when the version matches, and increments it. Otherwise it returns `409` with "Your addresses changed in another tab. Refresh and try again." The page shows that message with a Refresh button.
   - Test it with two parallel requests.

## Verify, then commit
- Lint and tests pass; `npm run migrate:fresh -- --seed` works.
- **Confirmations**: edit any record and you see the "Save these changes?" modal with the diff. Delete a chat message and you see the "Delete message?" modal.
- **Export**: Reports, Orders and the Audit log each give a CSV and a PDF that match the on-screen filters.
- **Accounts**:
  - creating an account shows the read-only default password;
  - Reset password works and signs the user out;
  - `farmer.unverified` lands on the Verify email page.
- **Farms**:
  - no lot number anywhere;
  - the size rejects 1.255;
  - Farms sorts by property number;
  - Farmers shows Farms owned.
- **Store**:
  - Beans replaces Seedlings;
  - adding a product with stock 8 is blocked;
  - no-photo products show the default image;
  - the landing carousel shows 8 best sellers.
- **Association**: the map pins select associations, and a pending farmer can message the Group Manager.
- **Hub**: mentions follow the role rules and notify.
- **Contact us** sends, and the address-book race test passes.
- Log Change 08 in the plan. Commit `Change 08A: …` through `Change 08G: …`, then stop.
