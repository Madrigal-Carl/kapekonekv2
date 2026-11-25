import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as moderation from '@/services/reviewModeration.service'
import { dashboardKeys } from './useDashboard'
import { productKeys } from './useProducts'

export const reviewModerationKeys = {
  all: ['admin-reviews'],
  list: (params) => ['admin-reviews', 'list', params],
  products: ['admin-reviews', 'products'],
  one: (id) => ['admin-reviews', 'one', id],
}

export const useAdminReviews = (params) =>
  useQuery({ queryKey: reviewModerationKeys.list(params), queryFn: () => moderation.listAdminReviews(params), placeholderData: keepPreviousData })
export const useReviewedProducts = () => useQuery({ queryKey: reviewModerationKeys.products, queryFn: moderation.listReviewedProducts, staleTime: 60_000 })
export const useAdminReview = (id) => useQuery({ queryKey: reviewModerationKeys.one(id), queryFn: () => moderation.getAdminReview(id), enabled: Boolean(id), retry: false })

/** The drawer keeps the returned review; the table, the badge and the product pages refresh. */
function useModeration(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (review) => {
      queryClient.setQueryData(reviewModerationKeys.one(review.id), review)
      queryClient.invalidateQueries({ queryKey: ['admin-reviews', 'list'] })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.badges })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useSaveReply = () => useModeration(moderation.saveReply)
export const useDeleteReply = () => useModeration(moderation.deleteReply)
export const useHideReview = () => useModeration(moderation.hideReview)
export const useUnhideReview = () => useModeration(moderation.unhideReview)
