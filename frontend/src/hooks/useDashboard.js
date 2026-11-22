import { useQuery } from '@tanstack/react-query'
import * as dashboardService from '@/services/dashboard.service'

export const dashboardKeys = {
  all: ['dashboard'],
  badges: ['dashboard', 'badges'],
  org: ['dashboard', 'org'],
  overview: ['dashboard', 'overview'],
}

export const useBadges = () => useQuery({ queryKey: dashboardKeys.badges, queryFn: dashboardService.getBadges, staleTime: 30_000 })
export const useOrgCard = () => useQuery({ queryKey: dashboardKeys.org, queryFn: dashboardService.getOrgCard, staleTime: 30_000 })
export const useOverview = () => useQuery({ queryKey: dashboardKeys.overview, queryFn: dashboardService.getOverview })
