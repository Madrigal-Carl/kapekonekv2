import { Button } from '@/components/ui/Button'
import { FarmPin } from '@/components/ui/FarmPin'
import 'mapbox-gl/dist/mapbox-gl.css'
import { IconLocate, IconMapPin, IconMaximize, IconMinus, IconPlus, IconSearch } from '@/components/ui/icons'

import { useEffect, useRef, useState } from 'react'
import MapGL, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import { toast } from 'sonner'
import { inputClasses } from '@/components/ui/Input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useBoundaries, usePlaceSearch } from '@/hooks/useGeo'
import { cn } from '@/lib/cn'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
// Delivery bounds (PRODUCT-SPEC §9): the whole-island view for a new address and the "fit Marinduque" button.
const ISLAND = [[121.8, 13.15], [122.2, 13.62]]
const FIT = { padding: 16 }
const FREE = 'Click the map to move the pin'
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const controlButton = 'grid size-9 cursor-pointer place-items-center border-0 bg-white text-ink hover:bg-cream'
const AREA_PADDING = 40
// PSGC boundaries (faeldon/philippines-json-maps), CC BY-IGO.
const ATTRIBUTION = { customAttribution: 'Boundaries: NAMRIA, PSA via OCHA COD-AB (CC BY-IGO)' }
// Mapbox paint can't read CSS variables, so the highlight colours are read from the theme tokens once.
const token = (name) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim())
const byName = (key, name) => ['==', ['get', key], name ?? '']

/** Bottom-left map label for a highlighted area (MiniMap.dc.html). */
const areaLabel = ({ municipality, barangay, label }) =>
  label ?? (barangay ? `${barangay}, ${municipality} · barangay highlighted` : municipality ? `${municipality} · municipality highlighted` : 'All of Marinduque')

/**
 * Mapbox map with a draggable pin, place search, zoom controls and "Use my location" (AddressModal.dc.html, MiniMap.dc.html).
 * Shared by the address and farm pickers. Geocoding goes through the API (`/geo/*`); this component only reports points
 * the user chose (`onPick(point, source)`). Without `onPick` it only shows the pin (a farm's details).
 * `focus` names the highlighted area (PSGC polygons: municipality fill caramel, barangay fill roast with its municipality
 * outlined). A new focus object with `fit` fits the map to that area (padding 40; no animation under reduced motion).
 * @param {{
 *   value: { lat: number, lng: number } | null,
 *   onPick: (point: { lat: number, lng: number }, source: 'map'|'search'|'locate') => void,
 *   focus: { municipality?: string|null, barangay?: string|null, fit?: boolean, label?: string },
 *   origin?: { lat: number, lng: number }, error?: string|null, busy?: boolean, note?: string|null,
 *   pinLabel?: string, ariaLabel?: string, searchable?: boolean, hints?: { empty: string, placed: string },
 *   preview?: boolean,
 * }} props
 * `preview`: a still thumbnail that fills its parent (address cards): no controls, no area label, not interactive.
 * Farm Map (MiniMap.dc.html pins): `pins` draws one pin per farm (`tone` farmer roast / kaluppa espresso), the selected one
 * larger with a caramel ring and `popup` above it; `onPin(id)` reports a pin click; a new `flyTo` object flies there.
 */
export function MapPicker({
  value,
  onPick,
  focus,
  origin,
  error,
  busy,
  note,
  pinLabel = 'Deliver here',
  ariaLabel = 'Map. Click to drop your delivery pin.',
  searchable = true,
  hints,
  preview = false,
  pins,
  selectedId,
  onPin,
  popup,
  flyTo,
}) {
  const pickable = Boolean(onPick)
  const map = useRef(null)
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  // Set once the user zooms or pans by hand: the label stops naming the select's place (null = `focus.label`).
  const [ownLabel, setOwnLabel] = useState(null)
  const search = usePlaceSearch(useDebouncedValue(query, 350))
  const [loaded, setLoaded] = useState(false)
  const towns = useBoundaries('municipality')
  const barangays = useBoundaries('barangay', focus.barangay ? focus.municipality : null)
  const [colors] = useState(() => ({ municipality: token('caramel'), barangay: token('roast') }))

  const move = (center, zoom) => {
    const camera = { center: [center.lng, center.lat], zoom }
    if (reducedMotion()) map.current?.jumpTo(camera)
    else map.current?.flyTo({ ...camera, duration: 1400 })
  }
  // A new focus object means the selects (or a pin drop) changed the area; the label names it again.
  const [shown, setShown] = useState(focus)
  if (shown !== focus) {
    setShown(focus)
    setOwnLabel(null)
  }
  const area = focus.barangay
    ? barangays.data?.features.find((f) => f.properties.barangay === focus.barangay)
    : towns.data?.features.find((f) => f.properties.municipality === focus.municipality)
  // Fit once per focus, as soon as the map and the area's polygon are both ready.
  const fitted = useRef(null)
  useEffect(() => {
    if (!focus.fit || !loaded || !area || fitted.current === focus) return
    fitted.current = focus
    const [w, s, e, n] = area.properties.bbox
    map.current?.fitBounds([[w, s], [e, n]], { padding: AREA_PADDING, duration: reducedMotion() ? 0 : 900 })
  }, [focus, loaded, area])

  useEffect(() => {
    if (flyTo && loaded) move(flyTo, flyTo.zoom ?? 14)
  }, [flyTo, loaded])
  const selectedPin = pins?.find((p) => p.id === selectedId)

  const pick = (point, source) => {
    if (source !== 'map') {
      move(point, 15)
      setOwnLabel(FREE)
    }
    onPick?.(point, source)
  }
  const fitIsland = () => {
    map.current?.fitBounds(ISLAND, { ...FIT, duration: reducedMotion() ? 0 : 900 })
    setOwnLabel('All of Marinduque')
  }
  const zoomBy = (direction) => {
    if (direction > 0) map.current?.zoomIn()
    else map.current?.zoomOut()
    setOwnLabel(FREE)
  }
  const useMine = () => {
    if (!navigator.geolocation) return toast.error('Your browser can’t share your location.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pick({ lat: coords.latitude, lng: coords.longitude }, 'locate'),
      () => toast.error('We couldn’t get your location. Allow location access or drop the pin yourself.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }
  const results = listOpen && query.trim().length >= 2 ? (search.data ?? []) : []

  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', preview ? 'h-full' : 'flex-[1_1_460px]')}>
      {searchable && pickable && (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1" onKeyDown={(e) => e.key === 'Escape' && listOpen && (e.stopPropagation(), setListOpen(false))}>
            <IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" strokeWidth={2} />
            <label htmlFor="place-search" className="sr-only">Search a place</label>
            <input
              id="place-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setListOpen(true)
              }}
              placeholder="Search a place, street or landmark"
              aria-controls={results.length > 0 ? 'place-results' : undefined}
              className={cn(inputClasses, 'py-2.5 pl-9 text-[13.5px]')}
            />
            {results.length > 0 && (
              <ul id="place-results" className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 list-none overflow-y-auto rounded-control border border-sand bg-white p-1 shadow-dropdown">
                {results.map((place) => (
                  <li key={`${place.lat},${place.lng}`}>
                    <Button variant="bare"
                      onClick={() => {
                        setListOpen(false)
                        setQuery(place.name)
                        pick({ lat: place.lat, lng: place.lng }, 'search')
                      }}
                      className="w-full cursor-pointer rounded-[4px] border-0 bg-transparent px-3 py-2 text-left hover:bg-crema"
                    >
                      <span className="block text-[13.5px] font-medium">{place.name}</span>
                      <span className="block text-xs text-ink-3">{place.fullAddress}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="outline" onClick={useMine} leftIcon={<IconLocate aria-hidden="true" className="size-[15px]" strokeWidth={2} />} className="gap-1.5 px-3 text-[13px] font-medium">
            Use my location
          </Button>
        </div>
      )}

      <div className={cn('relative overflow-hidden bg-water', preview ? 'h-full' : 'aspect-[600/440] rounded-card border border-sand')}>
        {TOKEN ? (
          <MapGL
            ref={map}
            mapboxAccessToken={TOKEN}
            initialViewState={value ? { latitude: value.lat, longitude: value.lng, zoom: 15 } : { bounds: ISLAND, fitBoundsOptions: FIT }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            cursor={pickable ? 'crosshair' : 'grab'}
            interactive={!preview}
            logoPosition="bottom-right"
            onClick={pickable ? (e) => pick({ lat: e.lngLat.lat, lng: e.lngLat.lng }, 'map') : undefined}
            onDragStart={() => setOwnLabel(FREE)}
            onLoad={(e) => {
              setLoaded(true)
              if (import.meta.env.DEV) window.__kkMap = e.target // e2e reads the drawn highlight layers
            }}
            attributionControl={ATTRIBUTION}
            style={{ width: '100%', height: '100%' }}
            aria-label={ariaLabel}
          >
            {origin && (
              <Marker latitude={origin.lat} longitude={origin.lng} anchor="top" offset={[0, -5]}>
                <span className="pointer-events-none flex flex-col items-center gap-0.5">
                  <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-espresso" />
                  <span className="whitespace-nowrap rounded-[4px] bg-white/90 px-1.5 py-px text-[10.5px] font-semibold text-ink">Kaluppa</span>
                </span>
              </Marker>
            )}
            {towns.data && (
              <Source id="kk-municipalities" type="geojson" data={towns.data}>
                <Layer id="kk-municipality-fill" type="fill" filter={byName('municipality', focus.municipality)} paint={{ 'fill-color': colors.municipality, 'fill-opacity': 0.16 }} />
                <Layer id="kk-municipality-line" type="line" filter={byName('municipality', focus.municipality)} paint={{ 'line-color': colors.municipality, 'line-width': 2 }} />
              </Source>
            )}
            {barangays.data && (
              <Source id="kk-barangays" type="geojson" data={barangays.data}>
                <Layer id="kk-barangay-fill" type="fill" filter={byName('barangay', focus.barangay)} paint={{ 'fill-color': colors.barangay, 'fill-opacity': 0.24 }} />
                <Layer id="kk-barangay-line" type="line" filter={byName('barangay', focus.barangay)} paint={{ 'line-color': colors.barangay, 'line-width': 2 }} />
              </Source>
            )}
            {pins?.map((p) => {
              const on = p.id === selectedId
              return (
                <Marker key={p.id} latitude={p.lat} longitude={p.lng} anchor="bottom" style={{ zIndex: on ? 3 : 1 }}>
                  <Button
                    variant="bare"
                    aria-label={p.label}
                    aria-pressed={on}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPin?.(p.id)
                    }}
                    className={cn('block h-9 w-[30px] origin-bottom cursor-pointer border-0 bg-transparent p-0 transition-transform duration-700', on && 'scale-[1.15]')}
                  >
                    <FarmPin tone={p.tone} selected={on} />
                  </Button>
                </Marker>
              )
            })}
            {selectedPin && popup && (
              <Marker latitude={selectedPin.lat} longitude={selectedPin.lng} anchor="bottom" offset={[0, -46]} style={{ zIndex: 5 }}>
                {popup}
              </Marker>
            )}
            {value && (
              <Marker latitude={value.lat} longitude={value.lng} anchor="bottom" draggable={pickable} onDragEnd={(e) => pick({ lat: e.lngLat.lat, lng: e.lngLat.lng }, 'map')}>
                <span className={cn('flex flex-col items-center', pickable && 'cursor-grab')}>
                  {!preview && <span className="mb-0.5 whitespace-nowrap rounded-[4px] bg-espresso px-2 py-[3px] text-[11px] font-semibold text-white">{pinLabel}</span>}
                  <IconMapPin aria-hidden="true" className={cn('fill-roast text-white', preview ? 'size-7' : 'size-[34px]')} strokeWidth={1.5} />
                </span>
              </Marker>
            )}
          </MapGL>
        ) : (
          <p className="grid h-full place-items-center p-6 text-center text-[13px] text-ink-2">The map isn’t available right now. Fill in the address fields instead.</p>
        )}
        {TOKEN && !preview && (
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-[6px] border border-sand-strong bg-white shadow-[0_4px_12px_-6px_rgb(43_26_18/0.35)]">
            <Button variant="bare" aria-label="Zoom in" onClick={() => zoomBy(1)} className={cn(controlButton, 'border-b border-sand-soft')}>
              <IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />
            </Button>
            <Button variant="bare" aria-label="Zoom out" onClick={() => zoomBy(-1)} className={cn(controlButton, 'border-b border-sand-soft')}>
              <IconMinus aria-hidden="true" className="size-4" strokeWidth={2} />
            </Button>
            <Button variant="bare" aria-label="Show all of Marinduque" onClick={fitIsland} className={cn(controlButton, 'text-roast')}>
              <IconMaximize aria-hidden="true" className="size-4" strokeWidth={2} />
            </Button>
          </div>
        )}
        {error && (
          <div role="alert" className="absolute left-3 right-[60px] top-3 rounded-[6px] border border-danger-line bg-danger-soft px-2.5 py-2 text-[12.5px] text-danger-text">
            {error}
          </div>
        )}
        {!preview && <span aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 rounded-[4px] bg-white/92 px-2 py-[3px] text-[11px] text-ink-2">
          {ownLabel ?? areaLabel(focus)}
        </span>}
      </div>

      {pickable && (
        <p aria-live="polite" className="m-0 flex items-center gap-2 text-[12.5px] text-ink-2">
          <IconMapPin aria-hidden="true" className="size-3.5 shrink-0 text-roast" strokeWidth={2} />
          {busy
            ? 'Finding the address for your pin…'
            : (note ??
              (value
                ? (hints?.placed ?? `Pin at ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)} · drag or click the map to put it on your exact spot.`)
                : (hints?.empty ?? 'No pin yet. Pick your municipality and barangay to zoom in, or click the map.')))}
        </p>
      )}
    </div>
  )
}
