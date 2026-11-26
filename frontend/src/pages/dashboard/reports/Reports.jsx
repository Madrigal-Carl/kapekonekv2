import { BarChart } from '@/components/dashboard/BarChart'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StageBar } from '@/components/dashboard/StageBar'
import { Button } from '@/components/ui/Button'
import { IconDownload } from '@/components/ui/icons'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { SINGLE_SERIES, stageItems, VARIETIES } from '@/constants/charts'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useCan } from '@/hooks/useCan'
import { useOrgCard } from '@/hooks/useDashboard'
import { useReport } from '@/hooks/useReports'
import { useTableParams } from '@/hooks/useTableParams'
import { formatKg, formatPesoShort } from '@/lib/format'
import { reportCsvUrl } from '@/services/report.service'
import { ChartCard, DashPage, KpiRow, Row } from '../overview/Overview'

const PERIOD_OPTIONS = [
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'last_30_days', label: 'Last 30 days' },
]
const download = <IconDownload aria-hidden="true" className="size-4" strokeWidth={2} />
const count = (n) => n.toLocaleString('en-PH')
const plural = (n, one) => `${count(n)} ${n === 1 ? one : `${one}s`}`

/** "▲ 11% vs previous period" (Reports.dc.html). */
function changeNote(figure) {
  if (figure.pct == null) return { text: 'Nothing to compare with the previous period', tone: 'muted' }
  return { text: `${figure.pct >= 0 ? '▲' : '▼'} ${Math.abs(figure.pct)}% vs previous period`, tone: figure.pct >= 0 ? 'good' : 'muted' }
}

/** A card's loading and error states; `children(data)` once loaded. */
function Loaded({ query, height = 280, children }) {
  if (query.isPending) return <Skeleton className="w-full" style={{ height }} />
  if (query.isError) {
    return (
      <p role="alert" className="text-[13px] text-ink-3">
        We couldn’t load this report.{' '}
        <Button variant="link" size="sm" onClick={() => query.refetch()} className="h-auto p-0 text-[13px]">Try again</Button>
      </p>
    )
  }
  return children(query.data)
}

function Kpis({ summary, isKaluppa }) {
  if (summary.isPending) return <KpiRow>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[110px]" />)}</KpiRow>
  if (summary.isError) return <Loaded query={summary}>{() => null}</Loaded>
  const s = summary.data
  const harvest = changeNote(s.harvest)
  return (
    <KpiRow>
      <KpiTile to="/dashboard/harvests" label="Harvest" icon="harvest" value={formatKg(s.harvest.kg)} note={harvest.text} tone={harvest.tone} />
      {isKaluppa ? (
        <>
          <KpiTile to="/dashboard/beans" label="Beans bought" icon="beans" value={formatKg(s.beans.kg)} note={`${formatPesoShort(s.beans.paidCentavos)} paid to farmers`} />
          <KpiTile to="/dashboard/orders" label="Store sales" icon="peso" value={formatPesoShort(s.sales?.centavos ?? 0)} note={plural(s.sales?.count ?? 0, 'sold order')} />
          <KpiTile to="/dashboard/farmers" label="Farmers" icon="farmers" value={count(s.farmers.count)} note={`+${count(s.farmers.newInPeriod)} this period`} tone={s.farmers.newInPeriod ? 'good' : 'muted'} />
        </>
      ) : (
        <>
          <KpiTile to="/dashboard/beans" label="Beans sold to Kaluppa" icon="beans" value={formatKg(s.beans.kg)} note={`${formatPesoShort(s.beans.paidCentavos)} earned by farmers`} />
          <KpiTile to="/dashboard/farms" label="Farms" icon="farm" value={count(s.farms.count)} note={`${s.farms.ha.toLocaleString('en-PH', { maximumFractionDigits: 1 })} ha`} />
          <KpiTile to="/dashboard/farmers" label="Farmers" icon="farmers" value={count(s.farmers.count)} note={`+${count(s.farmers.waiting)} waiting`} tone={s.farmers.waiting ? 'waiting' : 'muted'} />
        </>
      )}
    </KpiRow>
  )
}

const COLUMNS = {
  association: [['Association'], ['Farmers', 'farmers'], ['Farms', 'farms'], ['Trees', 'trees'], ['Harvest', 'harvestKg'], ['Beans sold', 'beansKg'], ['Paid', 'paidCentavos']],
  farmer: [['Farmer'], ['Farms', 'farms'], ['Trees', 'trees'], ['Harvest', 'harvestKg'], ['Beans sold', 'beansKg'], ['Earned', 'paidCentavos']],
}
const cell = (key, value) => {
  if (value == null) return '—'
  if (key === 'harvestKg' || key === 'beansKg') return formatKg(value)
  if (key === 'paidCentavos') return formatPesoShort(value)
  return count(value)
}

function Breakdown({ query, csvUrl, isKaluppa }) {
  const title = isKaluppa ? 'By association' : 'By farmer'
  return (
    <section aria-label={title} className="rounded-card border border-sand bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-sand-soft px-[18px] py-4">
        <h2 className="text-[15.5px] font-semibold">{title}</h2>
        <Button as="a" variant="outline" size="sm" href={csvUrl} download leftIcon={download} className="text-[13px]">Export CSV</Button>
      </div>
      {query.isPending || query.isError ? (
        <div className="p-[18px]">
          <Loaded query={query} height={180}>{() => null}</Loaded>
        </div>
      ) : query.data.rows.length === 0 ? (
        <p className="px-[18px] py-8 text-center text-[13px] text-ink-3">{isKaluppa ? 'No associations yet.' : 'No approved farmers yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-cream">
                {COLUMNS[query.data.kind].map(([label], i) => (
                  <th key={label} scope="col" className={`px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 ${i ? 'text-right' : 'text-left'}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <tr key={row.name} className="border-t border-skeleton">
                  {COLUMNS[query.data.kind].map(([label, key], i) =>
                    i ? (
                      <td key={label} className="px-3.5 py-[11px] text-right">{cell(key, row[key])}</td>
                    ) : (
                      <th key={label} scope="row" className="px-3.5 py-[11px] text-left font-semibold">{row.name}</th>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Reports (Reports.dc.html, PHASE-2-SPEC §3.12): Kaluppa across associations, a Group Manager for its own. */
export function Reports() {
  const isKaluppa = useCan('records.view_all')
  const sees = { sales: useCan('orders.manage') }
  const org = useOrgCard()
  const associations = useAssociationOptions()
  const { params, set } = useTableParams({ period: 'last_12_months' })
  const filters = { period: params.period, ...(isKaluppa && params.association && { association: params.association }) }
  const summary = useReport('summary', filters)
  const harvest = useReport('harvest', filters)
  const beans = useReport('beans', filters)
  const sales = useReport('sales', filters, { enabled: sees.sales })
  const trees = useReport('trees', filters)
  const breakdown = useReport('breakdown', filters)

  const selects = [
    { key: 'period', label: 'Period', options: PERIOD_OPTIONS },
    isKaluppa && { key: 'association', label: 'Association', options: [{ value: '', label: 'All associations' }, ...(associations.data ?? []).map((a) => ({ value: a.id, label: a.name }))] },
  ].filter(Boolean)

  return (
    <DashPage>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description={isKaluppa ? 'Harvests, beans, sales and trees across all associations.' : `Harvests, beans and trees in ${org.data?.association?.name ?? 'your association'}.`}
        actions={<Button as="a" variant="outline" href={reportCsvUrl('all', filters)} download leftIcon={download}>Export all (CSV)</Button>}
      />
      <div className="flex flex-wrap gap-2.5">
        {selects.map((f) => (
          <div key={f.key} className="w-60 max-[720px]:w-full">
            <SearchSelect aria-label={f.label} icon="tag" size="sm" searchable={false} options={f.options} value={params[f.key] ?? ''} onChange={(value) => set({ [f.key]: value || null })} />
          </div>
        ))}
      </div>
      <Kpis summary={summary} isKaluppa={isKaluppa} />
      <Row min={420}>
        <ChartCard title="Harvest by variety" sub="Kilograms per month, stacked">
          <Loaded query={harvest}>
            {(d) => (
              <BarChart
                labels={d.labels}
                series={VARIETIES.map((v) => ({ name: v.label, color: v.color, values: d.series.find((s) => s.variety === v.key)?.values ?? [] }))}
                suffix=" kg"
                height={240}
                aria="Harvest per month by variety"
                empty="No harvests recorded in this period"
              />
            )}
          </Loaded>
        </ChartCard>
        <ChartCard title={isKaluppa ? 'Beans bought by Kaluppa' : 'Beans sold to Kaluppa'} sub="Completed listings, kilograms per month">
          <Loaded query={beans}>
            {(d) => <BarChart labels={d.labels} series={[{ name: 'Beans bought', color: SINGLE_SERIES, values: d.values }]} suffix=" kg" height={240} aria="Beans bought per month" empty="No beans bought in this period" />}
          </Loaded>
        </ChartCard>
        {sees.sales && (
          <ChartCard title="Store sales" sub="Sold orders in pesos, buyers and farmers">
            <Loaded query={sales}>
              {(d) => <BarChart labels={d.labels} series={[{ name: 'Sales', color: SINGLE_SERIES, values: d.values.map((c) => c / 100) }]} prefix="₱" height={240} aria="Store sales per month" empty="No sold orders in this period" />}
            </Loaded>
          </ChartCard>
        )}
        <ChartCard title="Trees by stage" sub={trees.data ? `${count(trees.data.total)} trees` : ' '}>
          <Loaded query={trees} height={180}>
            {(d) => <StageBar items={stageItems(d.byStage)} />}
          </Loaded>
        </ChartCard>
      </Row>
      <Breakdown query={breakdown} csvUrl={reportCsvUrl('breakdown', filters)} isKaluppa={isKaluppa} />
    </DashPage>
  )
}
