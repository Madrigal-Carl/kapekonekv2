import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as catalog from '@/services/catalog.service'
import { useAuth } from './useAuth'

export const productKeys = {
  all: ['products'],
  categories: ['products', 'categories'],
  list: (filters) => ['products', 'list', filters],
  detail: (slug) => ['products', 'detail', slug],
  best: ['products', 'best'],
  reviews: (id) => ['products', id, 'reviews'],
  summary: (id) => ['products', id, 'reviews', 'summary'],
  myReview: (id) => ['products', id, 'reviews', 'me'],
}

/** The categories this viewer shops (buyers Coffee, farmers Beans and Fertilizer). */
export function useCategories() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...productKeys.categories, user?._id ?? null], queryFn: catalog.listCategories, staleTime: 5 * 60_000 })
}

/** Infinite product list for the given filters (the session is part of the key: `purchasable` depends on it). */
export function useProducts(filters, { enabled = true } = {}) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: [...productKeys.list(filters), user?._id ?? null],
    queryFn: ({ pageParam }) => catalog.listProducts({ ...filters, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** The landing best sellers for this viewer's categories (ranked daily on the server). */
export function useBestSellers() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...productKeys.best, user?._id ?? null], queryFn: catalog.listBestSellers, staleTime: 5 * 60_000 })
}

export function useProduct(slug) {
  const { user } = useAuth()
  return useQuery({ queryKey: [...productKeys.detail(slug), user?._id ?? null], queryFn: () => catalog.getProduct(slug) })
}

export const useReviews = (productId) =>
  useInfiniteQuery({
    queryKey: productKeys.reviews(productId),
    queryFn: ({ pageParam }) => catalog.listReviews(productId, { cursor: pageParam, limit: 5 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
    enabled: Boolean(productId),
  })

export const useReviewSummary = (productId) =>
  useQuery({ queryKey: productKeys.summary(productId), queryFn: () => catalog.getReviewSummary(productId), enabled: Boolean(productId) })

/** The signed-in, verified buyer's own review state. */
export function useMyReview(productId) {
  const { isAuthenticated, mustVerify } = useAuth()
  return useQuery({
    queryKey: productKeys.myReview(productId),
    queryFn: () => catalog.getMyReview(productId),
    enabled: Boolean(productId) && isAuthenticated && !mustVerify,
  })
}

/** Create or update the buyer's review, then refresh the product's reviews and rating. */
export function useSaveReview(productId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, ...body }) => (reviewId ? catalog.updateReview({ reviewId, ...body }) : catalog.createReview({ productId, ...body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

/** Delete the buyer's own review, then refresh the product's reviews, summary and rating. */
export function useDeleteReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: catalog.deleteReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
