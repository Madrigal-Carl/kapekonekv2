# Change 01 — Remove the per-order chat

**When to run:** after Phase 1 (M0–M7) is finished and committed.
**Goal:** remove the buyer ↔ Kaluppa chat on orders completely (UI, API, sockets, data, permissions, notifications, seeds, tests, docs), and apply the small screen updates that go with it. Everything else in Phase 1 stays as it is.

Decided by the user, so don't re-ask:
- There is **no chat on the order detail page** and no replacement contact feature. The rider name and phone in the "out for delivery" banner stay.
- **Socket.IO stays**, used only for `notification:new` and `order:updated`.
- General in-app messaging for dashboards is still a *future* feature. Build nothing for it now, and leave no chat code "for later".

## 0. Before you start

1. Read `CLAUDE.md`, then this file.
2. The user has copied the updated screens into `docs/design/screens/` (they replace the old ones):

| Screen | What changed |
|---|---|
| `OrderDetail.dc.html` | The "Chat with Kaluppa" panel is gone. The order content now spans the full width: status banner, items/totals, the address and payment cards side by side, then the status history. |
| `Main.dc.html` | In "What KapeKonek does", the third card "Chat with Kaluppa on every order" becomes **"Updates · Know where your order is · Email and in-app notifications at every step, from confirmation to delivery."** with a bell icon. |
| `ProductDetail.dc.html` | Sample review text no longer mentions messaging (seed data only). |
| `VerifyEmail.dc.html` | The helper text now reads "Adding to cart, checking out and reviewing need a verified email." ("chatting" removed). |

3. Make sure `git status` is clean, then create a branch: `git checkout -b change/remove-order-chat`.
4. Use **superpowers**: write a short plan to `docs/plans/change-01-remove-order-chat.md` listing every file you will delete or edit (find them with the search in §4), then carry it out.

## 1. Backend — remove

- **Models**: `Conversation`, `Message` (and their repositories, services, controllers, routes, Zod schemas, validators).
- **Routes**: `GET /orders/:id/conversation`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, `POST /conversations/:id/read`, and the message rate limiter.
- **Order service**:
  - stop creating a conversation when an order is placed;
  - remove "close the chat" from the final-status transitions;
  - remove any participant/moderation logic.
- **Realtime**:
  - remove the `conversation:join` / `conversation:leave` handlers, the `message:new` / `conversation:read` events and `realtime.toConversation`;
  - keep the socket auth, `user:<id>` rooms, `notification:new` and `order:updated`.
- **Permissions**: remove `chat.use` and `chat.moderate` from the permission seeder and every role, and clear the Valkey permission cache.
- **Notifications**: remove the `order_message` type, the buyer "new message" notification, and the Kaluppa "new buyer message" notification. Keep every order-status and refund notification.
- **Emails**: remove any message-related email job/template, if one exists.
- **Seeders**: remove the demo conversations, messages and message notifications.
- **Tests**: delete the chat tests; update any order/notification/permission tests that expected chat side effects.

## 2. Backend — clean up existing databases

Add an idempotent one-off command `backend/src/database/commands/drop-order-chat.js` and the script `npm run migrate:drop-order-chat`. It must:
1. Drop the `conversations` and `messages` collections if they exist.
2. Remove the `chat.use` and `chat.moderate` permissions and pull them from every role and user.
3. Delete notifications whose `type` is `order_message`.
4. Clear all `perm:user:*` keys in Valkey.
5. Print a summary.

It refuses to run in production without `--force`, like `migrate:fresh`. A fresh `npm run migrate:fresh -- --seed` must also produce a database with no chat data.

## 3. Frontend — remove and update

- **Remove**:
  - `ChatPanel`, `MessageBubble`, and the chat hooks (`useConversation`, `useMessages`, `useSendMessage`, read-state hooks);
  - the chat service functions and query keys;
  - the socket listeners for `message:new` / `conversation:read`.
- **Order detail** (`/orders/:id`): rebuild the layout to match the new `OrderDetail.dc.html` exactly (full-width content, no right column). Check it at 1440px and 390px.
- **Notifications dropdown**: drop the message type (icon, link and copy). The remaining types render as before.
- **Landing**: update the third "What KapeKonek does" card to match the new `Main.dc.html`.
- **Verify email page**: update the helper text to match the new `VerifyEmail.dc.html`.
- Remove any other "chat" or "message Kaluppa" copy, empty states or constants.

## 4. Find every leftover

Search the whole repo (excluding `node_modules`, `_reference`, `graphify-out` and `.git`) for these, case-insensitive:

```
chat · conversation · message:new · conversation:read · chat.use · chat.moderate · order_message · ChatPanel · MessageBubble · toConversation
```

- Remove or update every match that relates to order chat.
- The word "message" in general UI (form error messages, toasts, `AppError` messages, email bodies) is fine, so leave those alone.
- In your summary, list any matches you kept and why.

## 5. Docs — keep them true

| File | Update |
|---|---|
| `CLAUDE.md` | Remove the "Order chat: buyer ↔ Kaluppa" line and `realtime.toConversation`. Note that Socket.IO is for notifications and order updates only. |
| `docs/PRODUCT-SPEC.md` | Permissions table (drop `chat.*`); models (drop Conversation/Message, the `order_message` notification type); §3 (no chat closing); §4 (drop the Chat endpoints); §5 realtime events; §7 notifications; §8 order detail (no chat); §9 (drop the message length rule); §11 seeds (no chats). |
| `docs/DESIGN.md` | Drop the `ChatPanel`/`MessageBubble` row and the chat interaction. Update the OrderDetail notes. |
| `docs/prompts/PHASE-1-PROMPT.md` | Add one line at the top: "Order chat was removed later by Change 01." Don't rewrite history. |
| `README.md` | Remove chat from the feature list. Add the `migrate:drop-order-chat` command. |

## 6. Verify

1. `npm run lint` and `npm test` pass in both apps.
2. `npm run migrate:fresh -- --seed` works, and Mongo has no `conversations` or `messages` collections.
3. On a copy of a database seeded *before* this change, `npm run migrate:drop-order-chat` removes the chat data and running it a second time changes nothing.
4. **Playwright**:
   - `buyer@kapekonek.test` opens an order: no chat panel, the layout matches `OrderDetail.dc.html` at 1440px and 390px, and the status banner, items, address/payment cards and timeline all show.
   - Kaluppa moves the order to *out for delivery* through the API: the buyer gets the notification live (socket still works), and the order page updates.
   - Landing "What KapeKonek does" and the verify-email text match their screens.
5. `GET /api/conversations/...` returns 404 and `chat.*` appears nowhere in `/auth/me` permissions.
6. Run `/graphify . --update`.
7. Commit: `Remove per-order chat (Change 01)`. Add a short summary to `docs/plans/change-01-remove-order-chat.md`.

## Done when

- [ ] No order chat code, routes, socket events, permissions, notifications, seeds or tests remain (§4 search is clean or justified).
- [ ] Order detail matches the new screen; the landing and verify-email copy match.
- [ ] Notifications and live order updates still work.
- [ ] Existing databases can be cleaned with `migrate:drop-order-chat`; fresh seeds have no chat data.
- [ ] Docs updated; lint and tests green; committed on `change/remove-order-chat`.
