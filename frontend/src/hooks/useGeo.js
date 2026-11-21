import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import * as geo from '@/services/geo.service'

export const geoKeys = {
  search: (q) => ['geo', 'search', q],
  quote: (params) => ['delivery', 'quote', params],
}

export const useReverseGeocode = () => useMutation({ mutationFn: geo.reverseGeocode })

export const usePlaceSearch = (q) =>
  useQuery({ queryKey: geoKeys.search(q), queryFn: () => geo.searchPlaces(q), enabled: q.trim().length >= 2, staleTime: 5 * 60_000, placeholderData: keepPreviousData })

/** Fee preview for a map point (null point → disabled). */
export const usePointQuote = (point) =>
  useQuery({
    queryKey: geoKeys.quote(point && { lat: +point.lat.toFixed(4), lng: +point.lng.toFixed(4) }),
    queryFn: () => geo.getDeliveryQuote({ lat: point.lat, lng: point.lng }),
    enabled: Boolean(point),
    retry: false,
    staleTime: 5 * 60_000,
  })
