import { z } from 'zod';
import { objectIdRule, pageQuery } from './common.schema.js';
import { cancelReasonRule, commentBodyRule, POST_MEDIA_MAX, POST_TAGS, postBodyRule, postTagsRule } from './rules.js';

const mediaItem = z.object({ url: z.url('Upload it again').max(500), publicId: z.string().max(300).nullish(), alt: z.string().trim().max(200).optional() });

/** A Hub post (PHASE-2-SPEC §3.10, §7). On edit, media already on the post are matched by URL and kept as they are. */
/** People @mentioned (Change 08): user ids, or 'kaluppa' for the Kaluppa team. The service drops any not allowed. */
const mentionsRule = z.array(z.union([objectIdRule, z.literal('kaluppa')])).max(20, 'Mention up to 20 people').default([]);

export const postSchema = z.object({
  body: postBodyRule,
  tags: postTagsRule.default([]),
  mentions: mentionsRule,
  media: z.array(mediaItem).max(POST_MEDIA_MAX, `Add up to ${POST_MEDIA_MAX} photos or videos`).default([]),
});

export const feedQuery = pageQuery(20, 10).extend({ tag: z.enum(POST_TAGS, 'Pick a tag from the list').optional() });

export const commentSchema = z.object({ body: commentBodyRule, parentId: objectIdRule.optional(), mentions: mentionsRule });
export const commentEditSchema = z.object({ body: commentBodyRule, mentions: mentionsRule });
export const reactionSchema = z.object({ type: z.enum(['like', 'love', 'celebrate'], 'Pick Like, Love or Celebrate') });
/** Kaluppa removing a post or comment: the reason goes to the author. */
export const removeSchema = z.object({ reason: cancelReasonRule });
