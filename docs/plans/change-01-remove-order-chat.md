# Change 01 — Remove the per-order chat: plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Source: `docs/prompts/CHANGE-01-REMOVE-ORDER-CHAT.md`.

**Goal:** No buyer ↔ Kaluppa order chat anywhere. Socket.IO stays only for `notification:new` and `order:updated`.

**Timing note:** The change file says "run after Phase 1". It arrived when only M0 was committed, so no chat code, routes, sockets, seeds, tests or databases existed yet. The change is applied as a **spec change** before M1, so chat is never built. As a result:
- §1 and §3 (removing code) have nothing to delete. Instead, the Phase 1 plan no longer contains any chat tasks.
- §2 (`migrate:drop-order-chat`) is not built: no database ever held chat data, so the command would be dead code. See "Not done" below.
- The screen updates (OrderDetail full width, landing "Updates" card, VerifyEmail copy, review sample text) become requirements of the M3/M4/M2 tasks that build those pages.

## Files

| File | Edit |
|---|---|
| `docs/design/screens/{OrderDetail,Main,ProductDetail,VerifyEmail}.dc.html` | Already replaced by the user; committed here. |
| `docs/design/screens/canvas.json` | OrderDetail title: drop "+ chat with Kaluppa". |
| `CLAUDE.md` | Drop the order-chat bullet, `realtime.toConversation` and "chat" in the verification list; Socket.IO is for notifications and order updates only. |
| `docs/PRODUCT-SPEC.md` | §1 drop `chat.*`; §2 drop Conversation/Message and `order_message`; §3 no chat closing, no conversation on placement; §4 drop Chat endpoints; §5 events; §7 notifications; §8 order detail; §9 message rule; §10/§11 seeds. |
| `docs/DESIGN.md` | Drop the `ChatPanel`/`MessageBubble` row and the chat interaction; describe the full-width OrderDetail; Main "Updates" card. |
| `docs/prompts/PHASE-1-PROMPT.md` | One line at the top: "Order chat was removed later by Change 01." |
| `BUILD-GUIDE.md` | M5 row: notifications instead of chat. |
| `docs/plans/phase-1.md` | Remove chat throttle, `toConversation`, Conversation model, Task 5.1; M5 becomes "Notifications & live order updates"; add the screen updates to their tasks. |
| `docs/plans/phase-1-questions.md` | Item 6: no Conversation schema. |
| `README.md` | Doesn't exist yet (M7). Written without chat. |

## Verify

- [ ] §4 search (`chat · conversation · message:new · conversation:read · chat.use · chat.moderate · order_message · ChatPanel · MessageBubble · toConversation`) has matches only in the change file itself, this plan and the history note.
- [ ] `npm run lint` and `npm test` green (no code changed).
- [ ] Commit on `change/remove-order-chat`: `Remove per-order chat (Change 01)`; then fast-forward `phase-1` so M1 builds on it.
- The Playwright checks, `/api/conversations` → 404 and the `/auth/me` permission check become acceptance checks of M4/M5 (written into `phase-1.md`).

## Summary (2026-11-21)

- Applied as a spec change before M1. No code existed to remove; lint and tests stay green.
- Docs updated: `CLAUDE.md`, `PRODUCT-SPEC.md` (§1, §2, §3, §4, §5, §7, §8, §9, §10, §11, §13), `DESIGN.md`, `BUILD-GUIDE.md`, `canvas.json` title, one history line in `PHASE-1-PROMPT.md`, `phase-1.md` (M5 is now "Notifications & live order updates"; the OrderDetail, landing card, VerifyEmail and review-seed text are written into their tasks), `phase-1-questions.md`.
- §4 search matches that were kept:
  - lines that say there is no chat (`CLAUDE.md`, `PRODUCT-SPEC.md` §8, `phase-1.md` M5 and the review-seed rule);
  - this plan and the change file;
  - `PHASE-1-PROMPT.md` M5/§4, kept as history as instructed, with the note at the top.
- Not done: `migrate:drop-order-chat`. No database ever held chat data, so it would be dead code. It's easy to add if a pre-change database turns up.
- Deferred to the milestones that build the code: the Playwright checks (M4/M5) and the `/auth/me` / `/api/conversations` checks (M5 Task 5.2).
