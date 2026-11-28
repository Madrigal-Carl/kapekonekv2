import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as geo from '@/services/geo.service'

export const geoKeys = {
  search: (q) => ['geo', 'search', q],
  quote: (params) => ['delivery', 'quote', params],
  boundaries: (level, municipality) => ['geo', 'boundaries', level, municipality ?? null],
}

const boundariesQuery = (level, municipality) => ({
  queryKey: geoKeys.boundaries(level, municipality),
  queryFn: () => geo.getBoundaries(level, municipality),
  staleTime: Infinity, // boundaries don't move; the API also caches them for a week
})

/** Municipality polygons (`level='municipality'`) or one municipality's barangays (null municipality → disabled). */
export const useBoundaries = (level, municipality) =>
  useQuery({ ...boundariesQuery(level, municipality), enabled: level === 'municipality' || Boolean(municipality) })

/** `(municipality, barangay) => Promise<point|null>`: where the pin goes for a barangay picked from the list (its label point). */
export function useBarangayPoint() {
  const queryClient = useQueryClient()
  return async (municipality, barangay) => {
    const { features } = await queryClient.fetchQuery(boundariesQuery('barangay', municipality))
    const label = features.find((f) => f.properties.barangay === barangay)?.properties.label
    return label ? { lat: label[1], lng: label[0] } : null
  }
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
