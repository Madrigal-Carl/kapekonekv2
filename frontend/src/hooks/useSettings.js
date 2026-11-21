import { useQuery } from '@tanstack/react-query'
import * as settings from '@/services/setting.service'

export const settingKeys = { landing: ['settings', 'landing'] }

export const useLanding = () => useQuery({ queryKey: settingKeys.landing, queryFn: settings.getLanding, staleTime: 5 * 60_000 })
