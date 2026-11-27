# Change 07 — Sticky top bar, Sell beans at the limit, agreed layouts, Hub posting and viewing

**When to run:** after Change 06 is committed, in a fresh session (`/clear` first). Then continue with the next milestone (M12).

The user has replaced `CLAUDE.md`, `BUILD-GUIDE.md`, `SETUP.md` and `docs/` with an updated kit. These decisions are final; don't re-ask. Add a "Change 07" section to `docs/plans/phase-2.md` (superpowers), then make **one commit per part**.

## Read first
- `docs/DESIGN.md` §8.7 (layout rules to keep) and the Hub rows in §8.2 / §8.5.
- `docs/PHASE-2-SPEC.md` §3.10 (Hub: Create post modal, post viewer).
- Screens:
  - **new**: `BeansLimit`, `HubCreatePost`, `HubPostView`, `HubPostText`, `HubMobileCreate`, `HubMobileView`;
  - **changed**: every dashboard page (sticky top bar), `BeansFarmer`, `Hub`, `Inbox`, `Reports`.

## Part A — Sticky top bar, the selling limit, agreed layouts
1. **Sticky top bar**: the dashboard top bar (breadcrumb, notifications, avatar) is `position: sticky; top: 0` on every dashboard page, with a z-index above page content but below drawers, modals and the phone nav. Dropdowns in the page scroll under it.
2. **Sell beans at the limit** (`BeansLimit` board; `BeansFarmer` tweak status = limit):
   - When an unapproved farmer's pending + approved + completed listings reach **5 kg**, the **Sell beans** button is **disabled**: muted fill, `cursor: not-allowed`, and the line "You've used your 5 kg limit" under it, linked with `aria-describedby`.
   - The limit banner changes to "You've reached your 5 kg limit." with how to unlock it (approval, or a cancelled or rejected listing).
   - The API still rejects listings over the limit (`422`). The button state comes from the same `GET /beans/limit` numbers.
   - Group Managers can't pick a farmer who is at the limit when listing for them; that farmer shows as disabled with "limit reached".
3. **Keep these layouts; they were agreed while building, so don't undo them.** If any of them is already in the code, leave it; if a page isn't built yet, build it this way:
   - The **Hub** right column (most viewed, tags) is **sticky** (`top: 88px`) while the feed scrolls.
   - **Reports** charts sit in a **2×2 grid** (one column on phones).
   - **Inbox** and **Hub** use the **full content width** (no 1240px cap). The Hub feed stays 680px, centered, with the 340px aside beside it.

## Part B — Hub posting and viewing
- **If the Hub isn't built yet**, skip this part: M13 builds it from the updated spec. Note that in the plan.
- **If it exists**, rebuild posting and viewing to match the screens. Keep the feed data, API, tags, reactions, moderation and media rules as they are.
1. **Create post modal** (`HubCreatePost`, `HubMobileCreate`).
   - The feed's composer becomes a trigger card: avatar plus "What's on your mind, {first name}?", with **Photo / video** and **Tags** shortcuts underneath. Each one opens the modal; the shortcuts open it with the upload area or the tag picker showing.
   - **Modal**: 560 px wide, centered "Create post" title and round close button; your name with an audience chip; a borderless textarea (19 px text, 15 px once media is added); a dropzone; a media grid with a remove button on each item; tag chips; an "Add to your post" bar with photo and tag icon buttons; and a full-width Post button, disabled until there is text or media.
   - On phones it fills the screen.
   - **Edit post** reuses the modal ("Edit post" / "Save").
   - Closing with unsaved content asks "Discard this post?" (Keep editing / Discard).
   - Focus is trapped while it's open, Esc closes it, and focus returns to the trigger.
2. **Post viewer** (`HubPostView`, `HubPostText`, `HubMobileView`).
   - **Opens from** a media tile (at that item), the time, "See more", the comment count, Comment, or "Write a comment…".
   - It has a route: `/dashboard/hub/posts/:id?media=n`, so links and the back button work.
   - **With media**: a full-screen dialog.
     - **Left (400 px, white)**: author and role, the time and views, the full caption, tags (clicking one filters the feed and closes the viewer), reaction and comment counts, React / Comment with the picker, the full comment thread with replies, and a comment box pinned at the bottom.
     - **Right (dark stage)**: the photo or video with `object-fit: contain`, a "2 / 5" counter, prev / next buttons plus ← / → keys, a thumbnail strip, and a close button. Videos play inline with their controls.
   - **Text-only posts**: a centered 640 px dialog with the same panel.
   - **Phones**: the media takes the top 56% and the panel scrolls below it.
   - **Feed card**:
     - shows the last comment, "View all N comments" and a "Write a comment…" box (each opens the viewer);
     - cuts captions over 240 characters with "See more";
     - shows no inline comment thread.
   - Esc closes the viewer and focus returns to what opened it.

## Verify, then commit
- Lint and tests pass.
- Scroll a long page: the top bar stays put, and drawers, modals and dropdowns layer correctly.
- Sign in as `farmer.pending` with 5 kg listed: Sell beans is disabled. Cancel one listing and it's enabled again.
- Check that Inbox and Hub are full width, the Hub aside is sticky, and Reports is 2×2 (one column at 390px).
- If the Hub was rebuilt: post with photos and tags, edit, discard, then open the viewer from a tile, use prev / next, comment, and try a text-only post and a phone at 390px.
- Log Change 07 in the plan. Commit `Change 07A: …` and `Change 07B: …` (or note that B was deferred to M13), then stop.
