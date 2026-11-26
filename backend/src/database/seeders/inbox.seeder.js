import { findAssociationBySlug } from '../../repositories/association.repository.js';
import { anyMessage, insertSeedMessage, setLastMessage, setMemberState } from '../../repositories/chat.repository.js';
import { findUsersByUsernames } from '../../repositories/user.repository.js';
import { slugify } from '../../services/association.service.js';
import { ensureDirectChat, ensureKaluppaChat, joinGroup } from '../../services/chat.service.js';
import { seedMedia } from './media.js';

const MIN = 60_000;
const DAY = 24 * 60;
const ago = (minutes) => new Date(Date.now() - minutes * MIN);

/**
 * PHASE-2-SPEC §8 Inbox, around Rodel (farmer.approved), as in Inbox.dc.html: his Kaluppa chat (one unread),
 * the Santa Cruz group (Seen by 3, an edited and a deleted-for-everyone message, two unread), direct chats with
 * Liza (Delivered), Nestor (Sent) and Lorna (a photo), and the Boac group he left (read-only). Runs once.
 */
export async function seedInbox() {
  if (await anyMessage()) return 'already seeded';
  const handles = ['kaluppa', 'farmer.approved', 'manager.santacruz', 'manager.boac', 'nestor.perez', 'lorna.ilagan'];
  const u = Object.fromEntries((await findUsersByUsernames(handles)).map((x) => [x.username, x._id]));
  const [sc, boac] = await Promise.all(['Santa Cruz Coffee Growers', 'Boac Highland Farmers'].map((name) => findAssociationBySlug(slugify(name))));
  if (handles.some((h) => !u[h]) || !sc || !boac) return 'skipped (run the users and associations seeders first)';
  const media = await seedMedia();
  const photo = (key) => (media[key] ? [{ url: media[key].url, publicId: media[key].publicId ?? `seed/${key}`, name: `${key}.jpg`, bytes: 1_200_000, kind: 'image' }] : []);
  const rodel = u['farmer.approved'];
  const liza = u['manager.santacruz'];

  const kaluppaChat = await ensureKaluppaChat(rodel);
  const lizaKaluppaChat = await ensureKaluppaChat(liza);
  const group = await joinGroup(rodel, sc._id);
  const oldGroup = await joinGroup(rodel, boac._id);
  const [lizaChat, nestorChat, lornaChat] = await Promise.all([liza, u['nestor.perez'], u['lorna.ilagan']].map((other) => ensureDirectChat(rodel, other)));

  // [chat, sender, minutes ago, body, extra]
  const script = [
    [kaluppaChat, u.kaluppa, 74, 'Hi Rodel! We received your listing of 30 kg Liberica green beans.'],
    [kaluppaChat, rodel, 70, 'Good morning po. Can I bring them on Wednesday?', { key: 'k2' }],
    [kaluppaChat, u.kaluppa, 60, 'Your 30 kg listing is approved. Bring it within 7 days, Mon–Sat, 8 AM to 5 PM. Wednesday is fine.', { replyTo: 'k2' }],
    [lizaKaluppaChat, liza, 3 * DAY, 'Good afternoon! Can Kaluppa send someone for the pruning demo on Thursday?'],
    [lizaKaluppaChat, u.kaluppa, 3 * DAY - 40, 'Yes, two of our team will be there at 8 AM.'],
    [group, liza, 130, 'Reminder: pruning demo this Thursday at the Kaluppa farm. Bring your own shears.'],
    [group, u['nestor.perez'], 108, 'Leaf rust on my Excelsa again. Any tips?', { attachments: photo('cherries-dark') }],
    [group, rodel, 95, 'Try removing the infected leaves and spacing the branches for airflow. It helped mine.', { editedAt: ago(92) }],
    [group, u['lorna.ilagan'], 80, 'Wrong photo, sorry!', { deleted: true }],
    [group, liza, 60, 'Meeting on Saturday, 8 AM at the barangay hall.'],
    [lizaChat, liza, DAY + 100, 'Rodel, please add photos to your new tree group in Lot 7 so I can check the stage.'],
    [lizaChat, rodel, DAY + 92, 'Okay po, I’ll take them tomorrow morning.'],
    [lizaChat, rodel, DAY + 91, 'Thank you po! I’ll upload the photos later.'],
    [nestorChat, u['nestor.perez'], 2 * DAY + 30, 'Magandang umaga! Did you get the seedlings from Kaluppa?'],
    [nestorChat, rodel, 2 * DAY + 12, 'Yes, 50 pieces. Planting them this weekend.'],
    [lornaChat, u['lorna.ilagan'], 4 * DAY, 'Look at my new seedlings!', { attachments: photo('seedling-sprout') }],
    [oldGroup, u['manager.boac'], 40 * DAY, 'Welcome to our new members!'],
    [oldGroup, rodel, 40 * DAY - 20, 'Salamat po! Happy to be here.'],
  ];
  const keyed = {};
  const last = new Map();
  for (const [chat, sender, minutes, body, x = {}] of script) {
    const createdAt = ago(minutes);
    // One at a time, oldest first, so a reply's target exists.
    const message = await insertSeedMessage({
      conversation: chat._id,
      sender,
      body: x.deleted ? '' : body,
      attachments: x.deleted ? [] : (x.attachments ?? []),
      replyTo: x.replyTo ? keyed[x.replyTo]._id : null,
      editedAt: x.editedAt ?? null,
      deletedForEveryoneAt: x.deleted ? ago(minutes - 1) : null,
      createdAt,
      updatedAt: createdAt,
    });
    if (x.key) keyed[x.key] = message;
    last.set(String(chat._id), message);
  }

  // Each chat's preview is its newest message.
  for (const [chatId, m] of last) {
    const text = m.deletedForEveryoneAt ? 'This message was deleted' : m.body || 'Photo';
    await setLastMessage(chatId, { message: m._id, text, sender: m.sender, at: m.createdAt });
  }

  // Cursors: what each side has received and read (Sent / Delivered / Seen, unread counts).
  const upTo = (minutes, unreadCount = 0) => ({ lastDeliveredAt: ago(minutes), lastReadAt: ago(minutes), unreadCount });
  await Promise.all([
    setMemberState(kaluppaChat._id, { user: rodel }, upTo(65, 1)),
    setMemberState(kaluppaChat._id, { team: 'kaluppa' }, upTo(59)),
    setMemberState(lizaKaluppaChat._id, { user: liza }, upTo(3 * DAY - 50, 1)),
    setMemberState(lizaKaluppaChat._id, { team: 'kaluppa' }, upTo(3 * DAY - 41)),
    setMemberState(group._id, { user: rodel }, upTo(90, 2)),
    ...[liza, u['nestor.perez'], u['lorna.ilagan']].map((user) => setMemberState(group._id, { user }, upTo(55))),
    setMemberState(lizaChat._id, { user: rodel }, upTo(DAY + 90)),
    setMemberState(lizaChat._id, { user: liza }, { lastDeliveredAt: ago(DAY + 60), lastReadAt: ago(DAY + 92), unreadCount: 1 }),
    setMemberState(nestorChat._id, { user: rodel }, upTo(2 * DAY + 10)),
    setMemberState(nestorChat._id, { user: u['nestor.perez'] }, { lastDeliveredAt: ago(2 * DAY + 20), lastReadAt: ago(2 * DAY + 20), unreadCount: 1 }),
    setMemberState(lornaChat._id, { user: rodel }, upTo(4 * DAY - 10)),
    setMemberState(lornaChat._id, { user: u['lorna.ilagan'] }, upTo(4 * DAY)),
    // Rodel left Boac Highland Farmers: the chat stays, read-only.
    setMemberState(oldGroup._id, { user: rodel }, { ...upTo(40 * DAY - 25), canPost: false, leftAt: ago(39 * DAY) }),
  ]);
  return `${script.length} messages in ${last.size} chats`;
}
