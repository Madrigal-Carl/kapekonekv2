import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { connectSocket, emitSocket } from '@/lib/socket'
import { useTypingStore } from '@/stores/typing.store'
import { useAuth } from './useAuth'
import { beanKeys } from './useBeans'
import { dashboardKeys } from './useDashboard'
import { inboxKeys } from './useInbox'
import { notificationKeys } from './useNotifications'
import { orderKeys } from './useOrders'

/** Keep one socket open while signed in; each event refreshes the queries it affects. Mount once. */
export function useRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    const invalidate = (...keys) => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    return connectSocket({
      // Inbox (PHASE-2-SPEC §6): events carry ids; each refetch is the user's own view.
      connect: () => invalidate(inboxKeys.all), // catch up on anything missed while offline
      'message:new': ({ conversationId }) => {
        invalidate(inboxKeys.messages(conversationId), inboxKeys.lists, inboxKeys.one(conversationId), dashboardKeys.badges)
        // The open chat marks itself seen; any other chat only acknowledges delivery.
        if (useTypingStore.getState().openId !== conversationId) emitSocket('conversation:delivered', { conversationId })
      },
      'message:updated': ({ conversationId }) => invalidate(inboxKeys.messages(conversationId), inboxKeys.lists),
      'message:deleted': ({ conversationId }) => invalidate(inboxKeys.messages(conversationId), inboxKeys.lists, inboxKeys.one(conversationId)),
      'conversation:read': ({ conversationId }) => invalidate(inboxKeys.one(conversationId)),
      'conversation:delivered': ({ conversationId }) => invalidate(inboxKeys.one(conversationId)),
      'conversation:updated': () => invalidate(inboxKeys.all),
      typing: (payload) => useTypingStore.getState().setTyping(payload),
      // Notifications and order changes also move the dashboard's badges and overview counts.
      'notification:new': () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      },
      'bean:updated': () => {
        queryClient.invalidateQueries({ queryKey: beanKeys.all })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      },
      'order:updated': () => {
        queryClient.invalidateQueries({ queryKey: orderKeys.all })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      },
    })
  }, [userId, queryClient])
}
