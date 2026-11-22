import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { connectSocket } from '@/lib/socket'
import { useAuth } from './useAuth'
import { dashboardKeys } from './useDashboard'
import { notificationKeys } from './useNotifications'
import { orderKeys } from './useOrders'

/** Keep one socket open while signed in; each event refreshes the queries it affects. Mount once. */
export function useRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    return connectSocket({
      // Notifications and order changes also move the dashboard's badges and overview counts.
      'notification:new': () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      },
      'order:updated': () => {
        queryClient.invalidateQueries({ queryKey: orderKeys.all })
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      },
    })
  }, [userId, queryClient])
}
