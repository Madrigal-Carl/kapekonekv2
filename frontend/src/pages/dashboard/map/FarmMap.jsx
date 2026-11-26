import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { TREE_STAGES, VARIETIES } from '@/constants/charts'
import { MUNICIPALITIES } from '@/constants/records'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useCan } from '@/hooks/useCan'
import { useOrgCard } from '@/hooks/useDashboard'
import { useMapFarms } from '@/hooks/useRecords'
import { useTableParams } from '@/hooks/useTableParams'
import { cn } from '@/lib/cn'
import { formatDay } from '@/lib/date'
import { DashPage } from '../overview/Overview'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))

const label = (list, key) => list.find((x) => x.key === key)?.label ?? key
const ha = (n) => `${n.toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha`
const ownerLine = (f) => (f.ownerType === 'kaluppa' ? 'Kaluppa farm' : f.owner?.name ?? 'Deleted account')

/** The popover rows (PHASE-2-SPEC §3.11). */
function popRows(f) {
  const rows = [
    ['Association', f.association?.name ?? 'None'],
    ['Location', `${f.barangay}, ${f.municipality}`],
    ['Size', ha(f.sizeHa)],
    ['Trees', f.treeCount ? `${f.treeCount.toLocaleString('en-PH')} · ${f.varieties.map((v) => `${v.count.toLocaleString('en-PH')} ${label(VARIETIES, v.variety)}`).join(', ')}` : 'None yet'],
    ['Stages', f.stages.length ? f.stages.map((s) => `${label(TREE_STAGES, s.stage)} ${s.pct}%`).join(' · ') : '—'],
    ['Last harvest', f.lastHarvest ? `${formatDay(f.lastHarvest.harvestedAt, 'MMM d')} · ${f.lastHarvest.yieldKg.toLocaleString('en-PH')} kg` : 'None yet'],
  ]
  if (f.ownerType === 'kaluppa') rows.push(['Managed by', f.managedBy?.name ?? 'Not assigned'])
  return rows
}

/** The card above the selected pin (MiniMap.dc.html popover). */
function FarmPopover({ farm, onClose }) {
  return (
    <div role="dialog" aria-label={`${farm.lotNumber} · ${ownerLine(farm)}`} className="w-[264px] cursor-default rounded-card border border-sand bg-white p-3.5 text-ink shadow-[0_18px_40px_-18px_rgb(43_26_18/0.5)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block font-mono text-[11px] text-ink-3">{farm.propertyNumber}</span>
          <span className="block text-[14.5px] font-semibold leading-[1.3]">{`${farm.lotNumber} · ${ownerLine(farm)}`}</span>
        </div>
        <Button variant="ghost" size="sm" iconOnly aria-label="Close" onClick={onClose} className="size-[30px] min-h-0 shrink-0 text-ink-3">
          <IconX aria-hidden="true" className="size-[15px]" strokeWidth={2} />
        </Button>
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-[5px] text-[12.5px]">
        {popRows(farm).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="m-0 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <Button as={Link} to={`/dashboard/farms?open=${farm.id}`} variant="outline" size="sm" fullWidth className="mt-3 text-[13px]">
        Open farm
      </Button>
    </div>
  )
}

const LEGEND = [
  ['Farmer farm', 'rounded-full bg-roast'],
  ['Kaluppa farm', 'rounded-full bg-espresso'],
  ['Kaluppa branch', 'rounded-[3px] bg-espresso'],
]

/** Farm Map (FarmMap.dc.html, PHASE-2-SPEC §3.11): pins in the user's scope, filters, and a side list that flies to a farm. */
export function FarmMap() {
  const isKaluppa = useCan('records.view_all')
  const isManager = useCan('farmers.manage') && !isKaluppa
  const org = useOrgCard()
  const { params, set } = useTableParams()
  const filters = { association: params.association || undefined, municipality: params.municipality || undefined, variety: params.variety || undefined }
  const map = useMapFarms(filters)
  const associations = useAssociationOptions()
  const [selected, setSelected] = useState(null)
  const [flyTo, setFlyTo] = useState(null)

  const farms = useMemo(() => map.data?.farms ?? [], [map.data])
  const current = farms.find((f) => f.id === selected) ?? null
  const totals = farms.reduce((t, f) => ({ ha: t.ha + f.sizeHa, trees: t.trees + f.treeCount }), { ha: 0, trees: 0 })
  const muni = params.municipality || null
  const note = `${farms.length} ${farms.length === 1 ? 'farm' : 'farms'} shown${muni ? ` · ${muni} highlighted` : ''}`
  // A new focus object resets the map's area label and fits the municipality; keep it stable between renders.
  const focus = useMemo(
    () => (current ? { municipality: current.municipality, barangay: current.barangay, label: note } : { municipality: muni, fit: Boolean(muni), label: note }),
    [current, muni, note],
  )
  const pins = useMemo(() => farms.map((f) => ({ id: f.id, lat: f.location.lat, lng: f.location.lng, tone: f.ownerType, label: `${f.propertyNumber}, ${f.lotNumber}` })), [farms])

  const selectFilters = [
    isKaluppa && {
      key: 'association',
      label: 'Association',
      icon: 'tag',
      options: [{ value: '', label: 'All associations' }, ...(associations.data ?? []).map((a) => ({ value: a.id, label: a.name }))],
    },
    { key: 'municipality', label: 'Municipality', icon: 'pin', options: [{ value: '', label: 'All towns' }, ...MUNICIPALITIES.map((m) => ({ value: m, label: m }))] },
    { key: 'variety', label: 'Variety', icon: 'tag', options: [{ value: '', label: 'All varieties' }, ...VARIETIES.map((v) => ({ value: v.key, label: v.label }))] },
  ].filter(Boolean)
  const description = isKaluppa
    ? 'Every farm on KapeKonek, including Kaluppa’s own. Click a pin for details.'
    : isManager
      ? `Farms in ${org.data?.association?.name ?? 'your association'} and the Kaluppa farm you manage.`
      : 'Your farms on the map. Click a pin for details.'

  return (
    <DashPage>
      <PageHeader eyebrow="Map" title="Farm Map" description={description} />
      <div className="flex flex-wrap items-center gap-2.5">
        {selectFilters.map((f) => (
          <div key={f.key} className="w-[230px] max-[720px]:w-full">
            <SearchSelect
              aria-label={f.label}
              icon={f.icon}
              size="sm"
              searchable={false}
              options={f.options}
              value={params[f.key] ?? ''}
              onChange={(value) => {
                setSelected(null)
                set({ [f.key]: value || null })
              }}
            />
          </div>
        ))}
        <span className="flex-1" />
        <ul aria-label="Legend" className="m-0 flex list-none flex-wrap gap-3.5 p-0 text-[12.5px] text-ink-2">
          {LEGEND.map(([text, swatch]) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-3', swatch)} />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="relative z-[1] min-w-0 flex-[999_1_600px] rounded-[10px] border border-sand bg-white p-2">
          <Suspense fallback={<Skeleton className="aspect-[600/440] w-full" />}>
            <MapPicker
              value={null}
              focus={focus}
              origin={map.data?.branch.location}
              ariaLabel="Farms on the map of Marinduque"
              pins={pins}
              selectedId={selected}
              onPin={setSelected}
              flyTo={flyTo}
              popup={current && <FarmPopover farm={current} onClose={() => setSelected(null)} />}
            />
          </Suspense>
        </div>
        <section aria-label="Farms" className="min-w-0 max-w-[360px] flex-[1_1_300px] rounded-[10px] border border-sand bg-white max-[720px]:max-w-none">
          <div className="flex items-baseline justify-between border-b border-sand-soft px-4 py-3.5">
            <h2 className="text-[15px] font-semibold">{farms.length} {farms.length === 1 ? 'farm' : 'farms'}</h2>
            <span className="text-xs text-ink-3">{`${ha(totals.ha)} · ${totals.trees.toLocaleString('en-PH')} trees`}</span>
          </div>
          {map.isPending ? (
            <div aria-busy="true" aria-label="Loading farms" className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : map.isError ? (
            <p role="alert" className="p-4 text-[13px] text-ink-3">
              We couldn’t load the farms.{' '}
              <Button variant="link" size="sm" onClick={() => map.refetch()} className="h-auto p-0 text-[13px]">Try again</Button>
            </p>
          ) : farms.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">{params.municipality || params.variety || params.association ? 'No farms match these filters.' : 'No farms recorded yet.'}</p>
          ) : (
            <ul className="m-0 max-h-[560px] list-none overflow-y-auto p-0">
              {farms.map((f) => {
                const on = f.id === selected
                return (
                  <li key={f.id}>
                    <Button
                      variant="bare"
                      aria-pressed={on}
                      onClick={() => {
                        setSelected(f.id)
                        setFlyTo({ lat: f.location.lat, lng: f.location.lng, zoom: 14 })
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 border-0 border-b border-l-[3px] border-b-skeleton px-4 py-[11px] text-left text-ink',
                        on ? 'border-l-roast bg-highlight' : 'border-l-transparent bg-white hover:bg-cream',
                      )}
                    >
                      <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', f.ownerType === 'kaluppa' ? 'bg-espresso' : 'bg-roast')} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px] font-semibold">{f.propertyNumber}</span>
                        <span className="block text-xs text-ink-3">{`${ownerLine(f)} · ${f.barangay}, ${f.municipality}`}</span>
                      </span>
                      <span className="text-xs text-ink-2">{ha(f.sizeHa)}</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </DashPage>
  )
}
