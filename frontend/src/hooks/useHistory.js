import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import * as auditLogService from '@/services/auditLog.service'

export const historyKeys = {
  all: ['history'],
  entity: (entityType, entityId) => ['history', entityType, entityId],
  log: (params) => ['history', 'log', params],
  entry: (id) => ['history', 'entry', id],
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

/** The audit log page (Kaluppa). */
export const useAuditLog = (params) => useQuery({ queryKey: historyKeys.log(params), queryFn: () => auditLogService.listAuditLog(params), placeholderData: keepPreviousData })
/** One entry for the diff drawer; `initial` (the row already on the page) shows at once. */
export const useAuditEntry = (id, initial) =>
  useQuery({ queryKey: historyKeys.entry(id), queryFn: () => auditLogService.getAuditEntry(id), enabled: Boolean(id), retry: false, initialData: initial })
