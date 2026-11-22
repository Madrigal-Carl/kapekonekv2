# Change 04 — Fixed post media frames, Gmail seed accounts

**When to run:** on the finished Phase 1 app (Change 03 done), **before Phase 2 M8**, in a fresh session (`/clear` first).

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with the Phase 2 kit. These decisions are final; don't re-ask.

## 1. Bug: one post photo is taller than the others
- **Where it shows**: Kaluppa's "Fresh Liberica roasts are in!" post. The 5th upload (the 4th image, not counting the video) is a portrait photo. On the post page it makes the media taller than for the other photos, so the layout jumps.
- **The rule from now on** (see `PostDetail.dc.html` and DESIGN §8.2):
  - **Viewer / post page**:
    - one **fixed stage**: `aspect-ratio: 16/10`, `max-height: 560px`, `width: 100%`, `overflow: hidden`, background espresso `#1E130D`;
    - every image is `width: 100%; height: 100%; object-fit: contain`;
    - videos are `object-fit: contain` with a poster.
    - The stage never changes height between items.
  - **Thumbnails**: square, `object-fit: cover`.
  - **Landing and other post cards**: fixed `16/10` frame, `object-fit: cover`.
  - **Cloudinary URLs**: use `c_limit,w_1600` for the stage and `c_fill,g_auto,w_320,h_320` for thumbnails, so a huge portrait photo never arrives full size.
- **How to fix**:
  1. Reproduce the bug first: open that post, step to the 5th item and compare the stage height.
  2. Fix it in a shared `MediaStage` / `MediaThumb` component used by the post page, landing cards and anywhere else post media renders.
  3. Make sure the seeder keeps **at least one portrait photo** in that post as a test case.
  4. Add a Playwright check: step through every item of that post and assert the stage's bounding box height stays the same, at 1440px and 390px.

## 2. Seed accounts: Gmail and one password
- Change the seeders and docs: every seed email is `@gmail.com` and every seed password is **`KapeKonek@123`** (`SEED_DEFAULT_PASSWORD`).
- **Build addresses from handles**:
  - When `SEED_EMAIL_BASE` is set (e.g. `carl@gmail.com`), the email is `carl+<handle>@gmail.com`; Gmail delivers it to the owner's inbox.
  - Otherwise it's `kapekonek.<handle>@gmail.com`.
- **Handles**: `kaluppa`, `manager.santacruz`, `farmer.approved`, `farmer.unverified`, `buyer`, `buyer.unverified`.
  - The extra faker buyers use `kapekonek.buyer<n>`.
  - Usernames equal the handles, so sign-in by username works too. If Phase 1 login only accepts email, make it accept **email or username**.
- **Never email strangers**:
  - Add `isSeed: true` to seeded users.
  - When `SEED_EMAIL_BASE` is **unset**, the mail worker must not send to `isSeed` users. It writes the email to `backend/storage/mail/` with a `skipped-seed` note instead. Test this.
- Add `SEED_EMAIL_BASE=` (empty) to `backend/.env.example` with a comment.
- Update the docs:
  - `README` sign-in table;
  - `SETUP.md`;
  - `PRODUCT-SPEC` §11 (already updated in the kit; make the code match it).

## 3. Small copy
- Register: the farmer card text is now "Record your farms and sell beans to Kaluppa. Verify your email to start." (see `Register.dc.html`). The farmer email-verification rule itself ships in Phase 2 M8, not here.

## Verify, then commit
- `npm run lint` and `npm test` pass in both apps.
- `npm run migrate:fresh -- --seed` prints the new sign-in table. Log in as `buyer` with `KapeKonek@123`.
- The Playwright media-height check passes.
- Update `docs/plans/phase-1.md` (Change 04 log, with the root cause of the tall photo). Then commit `Change 04: fixed post media frames, Gmail seed accounts` and stop.

## Done when
- [ ] No post photo, portrait or landscape, changes the stage or card height anywhere.
- [ ] Every seed account is `@gmail.com` with password `KapeKonek@123`. Username sign-in works.
- [ ] Without `SEED_EMAIL_BASE`, no email is sent to seed accounts.
- [ ] Lint, tests and Playwright green; committed.
