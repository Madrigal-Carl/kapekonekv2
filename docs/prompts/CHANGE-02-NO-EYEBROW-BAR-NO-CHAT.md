# Change 02 — Remove the eyebrow bar, drop order chat from scope

**When to run:** right after **M2** is finished and committed, before starting M3.

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and the whole `docs/` folder with an updated version. Two decisions changed:

1. **No bar before eyebrow labels.**
   - Small uppercase labels such as "ACCOUNT ACCESS", "CREATE ACCOUNT", "FEATURED" or "ACCOUNT" no longer have the short caramel bar or dash in front of them. They're text only.
   - This applies to every page, including the dark auth panel.
   - All screens in `docs/design/screens/` are updated, and `docs/DESIGN.md` §3 is updated.
2. **No order chat at all.** Phase 1 has no Conversation or Message models, no chat endpoints or socket events, and no `chat.use` / `chat.moderate` permissions.
   - Socket.IO is only for `notification:new` and `order:updated`.
   - M5 is now "Notifications & live order updates".
   - `OrderDetail.dc.html` has no chat panel (full-width layout).
   - The landing "What KapeKonek does" third card is now "Updates · Know where your order is".

These are decided, so don't re-ask.

**Change 01 (remove order chat) has already been applied.** For decision 2, only check that nothing was missed and that the docs/plan agree. Skip work that's already done; don't redo it.

## Do this

1. Re-read `CLAUDE.md`, `docs/DESIGN.md` (§3 Eyebrow, §4 components), `docs/PRODUCT-SPEC.md` (§1 permissions, §2 models, §4–§8) and `docs/prompts/PHASE-1-PROMPT.md` (M5 and checklist).
2. **Eyebrow component:**
   - Remove the bar from the shared `Eyebrow` component, and from any place that renders it inline. It's just the uppercase label now (keep size, weight, tracking and color).
   - Fix every page built so far (Login, Register, ForgotPassword, ResetPassword, VerifyEmail, the auth brand panel, the Dashboard placeholder, 403/404) and compare them with their updated `.dc.html` screens at 1440px and 390px.
3. **Permissions from M2:**
   - Remove `chat.use` and `chat.moderate` from the permission seeder and every role, if M2 created them.
   - Re-run the role/permission seeder and clear the Valkey `perm:user:*` cache.
   - Update any test or constant that lists them.
4. **Remove any chat groundwork already built** (for example a `toConversation` helper or conversation rooms in the socket setup). Search the repo (excluding `node_modules`, `_reference`, `.git`, `graphify-out`) for `chat`, `conversation`, `toConversation`, `message:new`, `chat.use` and `chat.moderate`. Remove the order-chat related matches. General words like error "message" are fine.
5. **Plan:** update `docs/plans/phase-1.md` so M3–M7 match the new docs (no chat; M5 = notifications & live order updates; Order detail full width). Mention Change 02 in the plan's log.
6. **Verify:**
   - `npm run lint` and `npm test` pass in both apps.
   - `npm run migrate:fresh -- --seed` works.
   - Playwright screenshots of the auth pages and dashboard match their screens (no bars).
7. Commit: `Change 02: remove eyebrow bars, drop order chat from scope`. Then stop, so the user can start M3 with a fresh session.

## Done when

- [ ] No eyebrow bar anywhere in the built pages; the `Eyebrow` component is text-only.
- [ ] No `chat.*` permissions in the seeders, the database or `/auth/me`.
- [ ] No chat or conversation code exists.
- [ ] The plan reflects the new M5 and Order detail.
- [ ] Lint and tests green; committed.
