import { useInfiniteQuery } from '@tanstack/react-query'
import * as auditLogService from '@/services/auditLog.service'

export const historyKeys = {
  all: ['history'],
  entity: (entityType, entityId) => ['history', entityType, entityId],
}

/** A record's History, 5 entries a page. Always fresh when a drawer opens (staleTime 0): every edit adds an entry. */
export const useEntityHistory = (entityType, entityId) =>
  useInfiniteQuery({
    queryKey: historyKeys.entity(entityType, entityId),
    queryFn: ({ pageParam }) => auditLogService.getEntityHistory(entityType, entityId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(entityId),
    staleTime: 0,
  })
