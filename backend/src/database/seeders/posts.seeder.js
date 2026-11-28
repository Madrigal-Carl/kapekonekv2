import mongoose from 'mongoose';
import { ROLES } from '../../constants/permissions.js';
import { countPosts, insertComments, insertPosts, insertReactions, insertViews } from '../../repositories/post.repository.js';
import { findUserIdsByRole, findUsersByUsernames } from '../../repositories/user.repository.js';
import { refreshTopPosts } from '../../services/post.service.js';
import { manilaDateKey } from '../../utils/manilaDate.js';
import { seedMedia } from './media.js';

const HOUR = 60;
const DAY = 24 * HOUR;
const REACTIONS = ['like', 'love', 'celebrate'];

// author: account handle (= username); ago: minutes before seeding; tags: PHASE-2-SPEC §3.10;
// views: (viewer count) => distinct people-days of views, so the top 3 are Kaluppa, Liza and Nestor (Hub.dc.html, Main.dc.html);
// comments: [author, text, minutesAfterPost, replies[]]
const POSTS = [
  {
    author: 'kaluppa', ago: 2 * DAY, tags: ['announcement'], views: (n) => 3 * n,
    body: 'Fresh Liberica roasts are in! This batch came from three farmer groups in Mogpog and Santa Cruz, roasted medium for that classic barako body.\n\nOrders for this batch are open until stock runs out, with delivery anywhere in Marinduque. Thank you to everyone who sorted and dried these cherries.',
    // Keep the portrait photos (roasted-cooling-tray, coffee-bag-hand): the e2e media checks step through them (Change 04, M13).
    media: ['roasted-roaster-arm', 'roasted-cooling-tray', 'video-roasted-beans', 'roasted-pouring', 'coffee-bag-hand', 'coffee-pouches'],
    comments: [
      ['farmer.approved', 'Our group’s Liberica went into this batch! Salamat, Kaluppa.', 20, [
        ['kaluppa', 'Thank you to your group, Rodel. The cherries were beautifully sorted.', 22],
        ['manager.santacruz', 'Proud of the team. More drying next week.', 40],
      ]],
      ['manager.santacruz', 'Our Mogpog group can deliver more cherries next week.', 30, [
        ['kaluppa', 'Thanks, Liza! We’ll schedule the pickup at your farm.', 35],
      ]],
      ['lorna.ilagan', 'Will there be Excelsa in the next batch?', 60, [
        ['kaluppa', 'Yes, Excelsa roasting is planned for early December.', 68],
      ]],
    ],
  },
  {
    author: 'manager.santacruz', ago: 5 * HOUR, tags: ['advisory', 'soil'], views: (n) => n,
    body: 'Leaf rust is showing up after the October rains. Check the underside of older leaves for orange powder. Remove infected leaves, burn them away from the farm, and open the canopy so air moves through. Lime the soil if the pH is below 5.5.',
    media: ['cherries-dark', 'seedling-hand', 'fertilizer-granules'],
    comments: [
      ['farmer.approved', 'Does a copper fungicide help, or is pruning enough?', 50, [
        ['manager.santacruz', 'Start with pruning and spacing. Use copper only on heavily infected rows, after asking me first.', 80],
      ]],
      ['lorna.ilagan', 'Same problem in Matalaba. Thanks for this!', 150, []],
    ],
  },
  {
    author: 'farmer.approved', ago: 1 * DAY, tags: ['pruning'], views: () => 6,
    body: 'First pruning of the Lot 7 trees is done. Took out the suckers and the branches touching the ground. Before and after below.',
    media: ['cherries-branch', 'seedling-sprout'],
    comments: [['kaluppa', 'Looking good, Rodel! Open canopies dry faster after the rains.', 45, [['farmer.approved', 'Thanks! Lot 8 is next week.', 90]]]],
  },
  {
    author: 'kaluppa', ago: 3 * DAY, tags: ['announcement'], views: () => 8,
    body: 'Delivery now reaches every town in Marinduque. Add your address at checkout and you’ll see the delivery fee before you order.',
    media: ['parcels-stack'],
    comments: [],
  },
  {
    author: 'manager.santacruz', ago: 4 * DAY, tags: ['announcement', 'pruning'], views: () => 5,
    body: 'Group meeting this Saturday at the Balanacan barangay hall, 9 AM. We’ll talk about pruning schedules and the next delivery to Kaluppa.',
    media: [],
    comments: [['nestor.perez', 'I’ll be there. Can we also talk about the nursery seedlings?', 120, [['manager.santacruz', 'Yes, I’ll add it to the agenda.', 150]]]],
  },
  {
    author: 'farmer.approved', ago: 6 * DAY, tags: ['harvesting'], views: () => 4,
    body: 'First picking of the season done in our group’s farm. Cherries are drying now.',
    media: ['cherries-ripe', 'cherries-red'],
    comments: [['manager.santacruz', 'Great news, Rodel. Keep an eye out for berry borer after the rains.', 200, []]],
  },
  {
    author: 'nestor.perez', ago: 8 * DAY, tags: ['harvesting', 'processing'], views: (n) => n - 2,
    body: 'How we sort and dry Excelsa cherries on raised beds. 12 days in the sun, turned four times a day.',
    media: ['green-beans-drying', 'green-beans-heap'],
    comments: [['kaluppa', 'Raised beds make all the difference. These were some of the cleanest beans we received this month.', 300, []]],
  },
  {
    author: 'kaluppa', ago: 10 * DAY, tags: ['processing'], views: () => 7,
    body: 'A quick look at this morning’s roast. Robusta, dark, for the espresso crowd.',
    media: ['video-roasted-beans'],
    comments: [],
  },
  {
    author: 'lorna.ilagan', ago: 12 * DAY, tags: ['processing'], views: () => 6,
    body: 'Sorting green beans by hand before they go to Kaluppa. Slow work, but it shows in the cup.',
    media: ['green-beans-washing', 'green-beans-bowls', 'ground-spoon', 'ground-jar', 'brew-cup-table'],
    comments: [],
  },
  {
    author: 'kaluppa', ago: 14 * DAY, tags: ['advisory'], views: () => 3,
    body: 'Tip: keep roasted beans in a sealed bag away from sunlight, and grind just before brewing. Your coffee stays fresh for weeks.',
    media: [],
    comments: [],
  },
];

const minutesBefore = (now, m) => new Date(now.getTime() - m * 60_000);
const plus = (date, m) => new Date(date.getTime() + m * 60_000);

/** `count` distinct people-days of views: every viewer once a day, today first, never before the post's day. */
function viewsFor(post, createdAt, count, viewers, now) {
  const first = manilaDateKey(createdAt);
  const days = [];
  for (let t = now; manilaDateKey(t) >= first && days.length * viewers.length < count; t = minutesBefore(t, DAY)) days.push(manilaDateKey(t));
  return days.flatMap((day) => viewers.map((user) => ({ post, user, day, createdAt: now }))).slice(0, Math.max(0, count));
}

/** 10 tagged posts with comments, replies, reactions and views (filling the top 3). Skipped when posts exist. */
export async function seedPosts() {
  if ((await countPosts()) > 0) return 'skipped (posts exist)';
  const [media, users, viewerLists] = await Promise.all([
    seedMedia(),
    findUsersByUsernames(['kaluppa', 'manager.santacruz', 'farmer.approved', 'nestor.perez', 'lorna.ilagan']),
    Promise.all([ROLES.FARMER, ROLES.GROUP_MANAGER, ROLES.KALUPPA, ROLES.BUYER].map(findUserIdsByRole)),
  ]);
  const user = Object.fromEntries(users.map((u) => [u.username, u._id]));
  const community = Object.keys(user);
  const viewers = viewerLists.flat();
  const now = new Date();
  const posts = [];
  const comments = [];
  const reactions = [];
  const views = [];

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
    const seen = viewsFor(_id, createdAt, p.views(viewers.length), viewers, now);
    views.push(...seen);
    posts.push({
      _id,
      author: user[p.author],
      body: p.body,
      tags: p.tags,
      media: p.media.filter((k) => media[k]).map((k) => {
        const { type, url, publicId, alt, posterUrl, width, height, durationSec } = media[k];
        return { type, url, publicId, alt, posterUrl, width, height, durationSec };
      }),
      reactionCounts,
      commentCount,
      viewCount: seen.length,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await insertPosts(posts);
  await insertComments(comments);
  await insertReactions(reactions);
  await insertViews(views);
  const top = await refreshTopPosts(now);
  return `${posts.length} posts, ${comments.length} comments, ${reactions.length} reactions, ${views.length} views (top 3: ${top.map((t) => t.views).join(' / ')})`;
}
