import 'mapbox-gl/dist/mapbox-gl.css'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import MapGL, { Marker } from 'react-map-gl/mapbox'
import { toast } from 'sonner'
import { inputClasses } from '@/components/ui/Input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePlaceSearch } from '@/hooks/useGeo'
import { cn } from '@/lib/cn'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MARINDUQUE = { latitude: 13.4, longitude: 121.97, zoom: 9.3 }

/**
 * Mapbox map with a draggable delivery pin, place search and "Use my location" (AddressModal.dc.html).
 * Geocoding goes through the API (`/geo/*`); this component only reports points.
 * @param {{ value: { lat: number, lng: number } | null, onPick: (point: { lat: number, lng: number }) => void, origin?: { lat: number, lng: number }, error?: string|null, busy?: boolean }} props
 */
export function MapPicker({ value, onPick, origin, error, busy }) {
  const map = useRef(null)
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const search = usePlaceSearch(useDebouncedValue(query, 350))

  const pick = (point, fly = false) => {
    if (fly) map.current?.flyTo({ center: [point.lng, point.lat], zoom: 15 })
    onPick(point)
  }
  const useMine = () => {
    if (!navigator.geolocation) return toast.error('Your browser can’t share your location.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pick({ lat: coords.latitude, lng: coords.longitude }, true),
      () => toast.error('We couldn’t get your location. Allow location access or drop the pin yourself.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }
  const results = listOpen && query.trim().length >= 2 ? (search.data ?? []) : []

  return (
    <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1" onKeyDown={(e) => e.key === 'Escape' && listOpen && (e.stopPropagation(), setListOpen(false))}>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" strokeWidth={2} />
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
                  <button
                    type="button"
                    onClick={() => {
                      setListOpen(false)
                      setQuery(place.name)
                      pick({ lat: place.lat, lng: place.lng }, true)
                    }}
                    className="w-full cursor-pointer rounded-[4px] border-0 bg-transparent px-3 py-2 text-left hover:bg-crema"
                  >
                    <span className="block text-[13.5px] font-medium">{place.name}</span>
                    <span className="block text-xs text-ink-3">{place.fullAddress}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={useMine}
          className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-control border border-sand-strong bg-white px-3 text-[13px] font-medium text-ink hover:bg-cream"
        >
          <LocateFixed aria-hidden="true" className="size-[15px]" strokeWidth={2} />
          Use my location
        </button>
      </div>

      <div className="relative aspect-[600/440] overflow-hidden rounded-card border border-sand bg-water">
        {TOKEN ? (
          <MapGL
            ref={map}
            mapboxAccessToken={TOKEN}
            initialViewState={value ? { latitude: value.lat, longitude: value.lng, zoom: 14 } : MARINDUQUE}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            cursor="crosshair"
            onClick={(e) => pick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
            style={{ width: '100%', height: '100%' }}
            aria-label="Map. Click to drop your delivery pin."
          >
            {origin && (
              <Marker latitude={origin.lat} longitude={origin.lng} anchor="top">
                <span className="pointer-events-none whitespace-nowrap rounded-[4px] bg-white/90 px-1.5 py-px text-[10.5px] font-semibold text-ink">Kaluppa</span>
              </Marker>
            )}
            {value && (
              <Marker latitude={value.lat} longitude={value.lng} anchor="bottom" draggable onDragEnd={(e) => pick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}>
                <span className="flex cursor-grab flex-col items-center">
                  <span className="mb-0.5 whitespace-nowrap rounded-[4px] bg-espresso px-2 py-[3px] text-[11px] font-semibold text-white">Deliver here</span>
                  <MapPin aria-hidden="true" className="size-[34px] fill-roast text-white" strokeWidth={1.5} />
                </span>
              </Marker>
            )}
          </MapGL>
        ) : (
          <p className="grid h-full place-items-center p-6 text-center text-[13px] text-ink-2">The map isn’t available right now. Fill in the address fields instead.</p>
        )}
        {error && (
          <div role="alert" className="absolute inset-x-3 top-3 rounded-[6px] border border-danger-line bg-danger-soft px-2.5 py-2 text-[12.5px] text-danger-text">
            {error}
          </div>
        )}
        <span className="pointer-events-none absolute left-3 top-3 rounded-[4px] bg-white/90 px-2 py-[3px] text-[11px] text-ink-2">Click the map or drag the pin to move it</span>
      </div>

      <p aria-live="polite" className="m-0 flex items-center gap-2 text-[12.5px] text-ink-2">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-roast" strokeWidth={2} />
        {busy
          ? 'Finding the address for your pin…'
          : value
            ? `Pin at ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)} · fields below were filled from the pin. You can still edit them.`
            : 'No pin yet. Click the map where we should deliver, or fill in the fields by hand.'}
      </p>
    </div>
  )
}
