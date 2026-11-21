import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as notificationService from '@/services/notification.service'
import { useAuth } from './useAuth'
import { useCan } from './useCan'

export const notificationKeys = {
  all: ['notifications'],
  list: ['notifications', 'list'],
  unread: ['notifications', 'unread'],
}

/** Signed in, allowed to see notifications, and (for buyers) verified. */
function useNotificationsEnabled() {
  const { isAuthenticated, mustVerify } = useAuth()
  const canView = useCan('notifications.view')
  return canView && isAuthenticated && !mustVerify
}

export function useUnreadCount() {
  const enabled = useNotificationsEnabled()
  return useQuery({ queryKey: notificationKeys.unread, queryFn: notificationService.getUnreadCount, enabled })
}

/** The bell's list; only fetched while the panel is open. */
export function useNotifications(open) {
  const enabled = useNotificationsEnabled()
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => notificationService.listNotifications({ cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
    enabled: enabled && open,
  })
}

function useNotificationMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }) })
}

export const useMarkNotificationRead = () => useNotificationMutation(notificationService.markNotificationRead)
export const useMarkAllNotificationsRead = () => useNotificationMutation(notificationService.markAllNotificationsRead)
