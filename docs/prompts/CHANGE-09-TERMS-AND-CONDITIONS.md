# Change 09 — Terms and Conditions at sign-up and first sign-in

**When to run:** after Change 08 is committed, in a fresh session (`/clear` first). Then continue with the next milestone.

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with an updated kit. These decisions are final; don't re-ask. Add a "Change 09" section to `docs/plans/phase-2.md` (superpowers), then make **one commit per part**.

## Read first
- `docs/PHASE-2-SPEC.md` §3.17 (Terms and Conditions).
- `docs/DESIGN.md` §8.8 (Terms).

## Part A — Sign up, TermsModal, stored acceptance
- **Screens**: `Register` (checkbox), `RegisterTerms`, `RegisterTermsError`, `RegisterTermsMobile`, `TermsAccept`, and the `TermsModal` component.
- **Sign up**:
  - Add a required checkbox above **Create account**: "I agree to KapeKonek's Terms and Conditions and Privacy Policy." Only "I agree to KapeKonek's" is the checkbox label; the two document names are buttons that open `TermsModal` on that tab.
  - The checkbox starts unticked.
  - Clicking Create account without it shows "Please agree to the Terms and Conditions to create your account." under it, with a red outline on the checkbox, `aria-invalid` and `role="alert"`. Nothing is submitted.
  - The modal's **I agree** ticks the box and closes it.
  - The API rejects sign-up without `acceptTerms: true` (Zod `literal(true)`, `422`).
- **TermsModal**:
  - 640 px, two underline tabs (Terms and Conditions, Privacy Policy), "Version 1.0 · Last updated …", a scrolling body, and a footer. It's full screen on phones.
  - **Read mode**: Close / I agree; Esc and the backdrop close it.
  - **Accept mode**: it can't be dismissed. A checkbox, then Sign out / Agree and continue (disabled until ticked).
  - **Content**: put the text in versioned files (`server/src/legal/terms.v1.md`, `privacy.v1.md`) served by `GET /legal/current`, not hard-coded in components. The text on the screens is a plain-language starting draft; mark it as a draft in the plan so Kaluppa has it reviewed before launch.
- **Accounts made by Kaluppa or a Group Manager**: after they verify their email and sign in for the first time, show `TermsModal` in **accept mode** (`TermsAccept`) before the dashboard. "Sign out" signs them out.
- **Stored acceptance**:
  - Save `termsAcceptedAt` and `termsVersion` on the user, plus an audit entry "accepted the terms (v1)".
  - When `TERMS_VERSION` is raised, every user sees accept mode at their next sign-in.
  - Seeded accounts are seeded as accepted at the current version.

## Part B — Agreement on first sign-in
- Use `TermsModal` in **accept mode** (board `TermsAccept`): for accounts made by Kaluppa or a Group Manager on their first sign-in, and for any user whose `termsVersion` is older than `TERMS_VERSION`.
- It's a blocking step after sign-in and before any dashboard or storefront page. The API returns `403 TERMS_REQUIRED` for everything except `GET /legal/current`, `POST /legal/accept` and sign-out until the user accepts.
- **Agree and continue** calls `POST /legal/accept {version}`, then continues to where they were going.

## Verify, then commit
- Lint and tests pass; `npm run migrate:fresh -- --seed` works, with seeded users already accepted.
- Sign-up is blocked until the box is ticked, and the API refuses it without `acceptTerms: true`.
- The modal opens on the right tab from each link, and its **I agree** ticks the box.
- An account made by a Group Manager, once verified, sees accept mode on first sign-in and can't get past it without agreeing; Sign out works.
- Raising `TERMS_VERSION` asks every user again at their next sign-in.
- Check at 390px: the modal fills the screen.
- Log Change 09 in the plan. Commit `Change 09A: …` and `Change 09B: …`, then stop.
