import { z } from 'zod'
import { ratingRule, reviewCommentRule } from './rules.js'

export const reviewSchema = z.object({ rating: ratingRule, comment: reviewCommentRule })
