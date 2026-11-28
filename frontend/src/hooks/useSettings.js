import { useQuery } from '@tanstack/react-query'
import * as settings from '@/services/setting.service'

export const settingKeys = {
  all: ['settings'],
  landing: ['settings', 'landing'],
  delivery: ['settings', 'delivery'],
  locations: ['settings', 'locations'],
  payment: ['settings', 'payment'],
}

export const useLanding = () => useQuery({ queryKey: settingKeys.landing, queryFn: settings.getLanding, staleTime: 5 * 60_000 })

const LONG = { staleTime: 30 * 60_000 }
export const useDeliveryInfo = () => useQuery({ queryKey: settingKeys.delivery, queryFn: settings.getDeliveryInfo, ...LONG })
/** The e-wallets shown at checkout (public); every payment sentence is built from these (`lib/payments`). */
export const usePaymentProviders = () => useDeliveryInfo().data?.payment?.providers ?? []
export const useLocations = () => useQuery({ queryKey: settingKeys.locations, queryFn: settings.getLocations, staleTime: Infinity })
export const usePaymentSettings = () => useQuery({ queryKey: settingKeys.payment, queryFn: settings.getPaymentSettings, ...LONG })
