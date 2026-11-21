import mongoose from 'mongoose';
import { countPosts, insertComments, insertPosts, insertReactions } from '../../repositories/post.repository.js';
import { findUsersByEmails } from '../../repositories/user.repository.js';
import { seedMedia } from './media.js';

const HOUR = 60;
const DAY = 24 * HOUR;
const REACTIONS = ['like', 'love', 'celebrate'];

// author: account local part; ago: minutes before seeding; comments: [author, text, minutesAfterPost, replies[]]
const POSTS = [
  {
    author: 'kaluppa', ago: 2 * HOUR,
    body: 'Fresh Liberica roasts are in! This batch came from three farmer groups in Mogpog and Santa Cruz, roasted medium for that classic barako body.\n\nOrders for this batch are open until stock runs out, with delivery anywhere in Marinduque. Thank you to everyone who sorted and dried these cherries.',
    media: ['roasted-roaster-arm', 'roasted-cooling-tray', 'video-roasted-beans', 'roasted-pouring', 'coffee-bag-hand', 'coffee-pouches'],
    comments: [
      ['farmer1', 'Our group’s Liberica went into this batch! Salamat, Kaluppa.', 20, [
        ['kaluppa', 'Thank you to your group, Rodel. The cherries were beautifully sorted.', 22],
        ['manager', 'Proud of the team. More drying next week.', 40],
      ]],
      ['manager', 'Our Mogpog group can deliver more cherries next week.', 30, [
        ['kaluppa', 'Thanks, Liza! We’ll schedule the pickup at your farm.', 35],
      ]],
      ['farmer2', 'Will there be Excelsa in the next batch?', 60, [
        ['kaluppa', 'Yes, Excelsa roasting is planned for early December.', 68],
      ]],
    ],
  },
  {
    author: 'farmer1', ago: 1 * DAY,
    body: 'First picking of the season done in our group’s farm. Cherries are drying now.',
    media: ['cherries-branch', 'green-beans-drying'],
    comments: [['kaluppa', 'Looking good, Rodel! Send us word when they’re ready for sorting.', 45, [['farmer1', 'Will do. About two weeks of drying left.', 90]]]],
  },
  {
    author: 'kaluppa', ago: 3 * DAY,
    body: 'Delivery now reaches every town in Marinduque. Add your address at checkout and you’ll see the delivery fee before you order.',
    media: ['parcels-stack'],
    comments: [],
  },
  {
    author: 'manager', ago: 4 * DAY,
    body: 'Group meeting this Saturday at the Balanacan barangay hall, 9 AM. We’ll talk about pruning schedules and the next delivery to Kaluppa.',
    media: [],
    comments: [['farmer2', 'I’ll be there. Can we also talk about the nursery seedlings?', 120, [['manager', 'Yes, I’ll add it to the agenda.', 150]]]],
  },
  {
    author: 'farmer2', ago: 6 * DAY,
    body: 'Our Excelsa trees are flowering early this year. Hoping for a good harvest.',
    media: ['cherries-ripe'],
    comments: [['manager', 'Great news, Nora. Keep an eye out for berry borer after the rains.', 200, []]],
  },
  {
    author: 'kaluppa', ago: 8 * DAY,
    body: 'A quick look at this morning’s roast. Robusta, dark, for the espresso crowd.',
    media: ['video-roasted-beans'],
    comments: [],
  },
  {
    author: 'farmer1', ago: 10 * DAY,
    body: 'Sorting green beans by hand before they go to Kaluppa. Slow work, but it shows in the cup.',
    media: ['green-beans-washing', 'green-beans-heap', 'green-beans-bowls'],
    comments: [['kaluppa', 'It really does. These were some of the cleanest beans we received this month.', 300, []]],
  },
  {
    author: 'kaluppa', ago: 12 * DAY,
    body: 'Tip: keep roasted beans in a sealed bag away from sunlight, and grind just before brewing. Your coffee stays fresh for weeks.',
    media: [],
    comments: [],
  },
];

const minutesBefore = (now, m) => new Date(now.getTime() - m * 60_000);
const plus = (date, m) => new Date(date.getTime() + m * 60_000);

/** ~8 posts with comments, replies and reactions from farmers, the Group Manager and Kaluppa. Skipped when posts exist. */
export async function seedPosts() {
  if ((await countPosts()) > 0) return 'skipped (posts exist)';
  const [media, users] = await Promise.all([
    seedMedia(),
    findUsersByEmails(['kaluppa', 'manager', 'farmer1', 'farmer2'].map((e) => `${e}@kapekonek.test`)),
  ]);
  const user = Object.fromEntries(users.map((u) => [u.email.split('@')[0], u._id]));
  const community = Object.keys(user);
  const now = new Date();
  const posts = [];
  const comments = [];
  const reactions = [];

  POSTS.forEach((p, i) => {
    const _id = new mongoose.Types.ObjectId();
    const createdAt = minutesBefore(now, p.ago);
    // Everyone but the author reacts; the type varies by post so the summary isn't uniform.
    const reactors = community.filter((c) => c !== p.author);
    const reactionCounts = { like: 0, love: 0, celebrate: 0 };
    reactors.forEach((c, j) => {
      const type = REACTIONS[(i + j) % 3];
      reactionCounts[type] += 1;
      reactions.push({ targetType: 'post', target: _id, user: user[c], type, createdAt: plus(createdAt, 5 + j) });
    });
    let commentCount = 0;
    for (const [author, body, after, replies] of p.comments) {
      const commentId = new mongoose.Types.ObjectId();
      const at = plus(createdAt, after);
      const likers = community.filter((c) => c !== author).slice(0, (i + after) % 3);
      likers.forEach((c) => reactions.push({ targetType: 'comment', target: commentId, user: user[c], type: 'love', createdAt: plus(at, 3) }));
      comments.push({ _id: commentId, post: _id, author: user[author], parent: null, body, replyCount: replies.length, reactionCount: likers.length, createdAt: at, updatedAt: at });
      for (const [replyAuthor, replyBody, replyAfter] of replies) {
        const replyAt = plus(createdAt, replyAfter);
        comments.push({ post: _id, author: user[replyAuthor], parent: commentId, body: replyBody, createdAt: replyAt, updatedAt: replyAt });
      }
      commentCount += 1 + replies.length;
    }
    posts.push({
      _id,
      author: user[p.author],
      body: p.body,
      media: p.media.filter((k) => media[k]).map((k) => {
        const { type, url, publicId, alt, posterUrl, width, height, durationSec } = media[k];
        return { type, url, publicId, alt, posterUrl, width, height, durationSec };
      }),
      reactionCounts,
      commentCount,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await insertPosts(posts);
  await insertComments(comments);
  await insertReactions(reactions);
  return `${posts.length} posts, ${comments.length} comments, ${reactions.length} reactions`;
}
