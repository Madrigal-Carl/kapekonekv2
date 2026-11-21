import { useEffect, useRef } from 'react'

/**
 * Infinite scroll: attach the returned ref to an element after the list; the next page loads as it nears the viewport.
 * @param {{ hasNextPage?: boolean, isFetchingNextPage: boolean, fetchNextPage: () => unknown }} query a useInfiniteQuery result
 */
export function useInfiniteSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }) {
  const sentinel = useRef(null)
  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  return sentinel
}
