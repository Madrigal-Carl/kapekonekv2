import { lazy, Suspense, useMemo } from 'react'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))

/**
 * "Or pick one on the map" (AssociationModal.dc.html, FarmerAssociation.dc.html, Change 08): a pin per active association
 * (its meeting point or its town's centre). Picking a pin selects it; the selected association's town is shaded.
 * @param {{ options: Array<{ id: string, name: string, municipality: string, location: { lat: number, lng: number } }>, value: string, onChange: (id: string) => void }} props
 */
export function AssociationMap({ options, value, onChange }) {
  const pins = useMemo(() => options.map((o) => ({ id: o.id, lat: o.location.lat, lng: o.location.lng, tone: 'farmer', label: o.name })), [options])
  const chosen = options.find((o) => o.id === value)
  // A new focus object per selection fits the map to that town once (MapPicker).
  const focus = useMemo(() => (chosen ? { municipality: chosen.municipality, fit: true } : {}), [chosen])
  return (
    <div>
      <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Or pick one on the map</span>
      <div className="mt-1.5">
        <Suspense fallback={<div className="aspect-[600/440] animate-pulse rounded-card bg-water" />}>
          <MapPicker
            value={null}
            focus={focus}
            pins={pins}
            selectedId={value || null}
            onPin={onChange}
            popup={chosen && <span className="whitespace-nowrap text-[12.5px] font-semibold">{chosen.name} · {chosen.municipality}</span>}
            searchable={false}
            ariaLabel="Map of active associations. Choose a pin to pick that association."
          />
        </Suspense>
      </div>
      <p className="mt-1.5 text-xs leading-normal text-ink-3">Pins mark the active associations. Picking a pin selects it above; the shaded area is its town.</p>
    </div>
  )
}
