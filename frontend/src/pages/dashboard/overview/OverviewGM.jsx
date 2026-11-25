import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import { BarChart } from '@/components/dashboard/BarChart'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { ListPanel } from '@/components/dashboard/ListPanel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StageBar } from '@/components/dashboard/StageBar'
import { stageItems, VARIETIES } from '@/constants/charts'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { greeting } from '@/lib/date'
import { format } from 'date-fns'
import { ChartCard, HeaderAction, KpiRow, Row } from './Overview'

const AVATARS = ['bg-caramel-ink', 'bg-avatar-green', 'bg-roast', 'bg-ink-2']
const kg = (n) => `${n.toLocaleString('en-PH', { maximumFractionDigits: 1 })} kg`
const waitingLine = (n) => (n === 0 ? 'No farmers are waiting for your approval.' : `${n} ${n === 1 ? 'farmer is' : 'farmers are'} waiting for your approval.`)

/** Group Manager overview (OverviewGM.dc.html). Farms, harvests and beans fill in from M9/M10. */
export function OverviewGM({ data }) {
  const { user } = useAuth()
  const { association, kpis, queue, harvestByMonth, treesByStage } = data
  const stages = stageItems(treesByStage)
  const trees = stages.reduce((s, i) => s + i.count, 0)
  const series = VARIETIES.map((v) => ({ name: v.label, color: v.color, values: harvestByMonth.series?.find((s) => s.variety === v.key)?.values ?? harvestByMonth.labels.map(() => 0) }))

  return (
    <>
      <PageHeader
        eyebrow={`Group Manager · ${association?.name ?? 'No association yet'}`}
        title={`${greeting()}, ${user.firstName}`}
        description={waitingLine(kpis.waiting)}
        actions={association && <HeaderAction to="/dashboard/farmers?open=new" plus>Add farmer</HeaderAction>}
      />
      <KpiRow>
        <KpiTile to="/dashboard/farmers" label="Farmers" icon="farmers" value={kpis.farmers} note={kpis.waiting ? `${kpis.waiting} waiting for approval` : 'No one waiting'} tone={kpis.waiting ? 'waiting' : 'muted'} />
        <KpiTile to="/dashboard/farms" label="Farms" icon="farm" value={kpis.farms} note={kpis.farms ? undefined : 'No farms recorded yet'} />
        <KpiTile to="/dashboard/harvests" label="Harvest this year" icon="harvest" value={kg(kpis.harvestThisYearKg)} note={kpis.harvestThisYearKg ? undefined : 'Nothing recorded this year'} />
        <KpiTile to="/dashboard/beans" label="Beans to Kaluppa" icon="beans" value={kg(kpis.beansKg)} note={kpis.beansKg ? undefined : 'No bean sales yet'} />
      </KpiRow>
      <Row>
        <ListPanel
          title="Waiting for your approval"
          link={{ to: '/dashboard/farmers?status=pending', label: 'Open queue' }}
          empty="No one is waiting for approval."
          rows={queue.map((q, i) => ({
            key: q.id,
            title: q.name,
            sub: q.kind === 'transfer' ? `Transfer from ${q.from ?? 'another association'}` : `Requested ${format(new Date(q.requestedAt), 'MMM d')} · ID + proof of land`,
            lead: (
              <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white', AVATARS[i % AVATARS.length])}>
                {q.initials}
              </span>
            ),
            action: (
              <Button
                as={Link}
                variant="outline"
                size="sm"
                to={`/dashboard/farmers?open=${q.id}&mode=view`}
                aria-label={`Review ${q.name}`}
                className="text-[12.5px]"
              >
                Review
              </Button>
            ),
          }))}
        />
        <ChartCard title="Association harvest per month" sub={`All ${kpis.farmers} ${kpis.farmers === 1 ? 'farmer' : 'farmers'}, last 12 months`}>
          <BarChart labels={harvestByMonth.labels} series={series} suffix=" kg" aria="Association harvest per month by variety" empty="No harvests recorded yet" />
        </ChartCard>
      </Row>
      <Row>
        <ChartCard title="Trees by stage" sub={trees ? `${trees.toLocaleString('en-PH')} trees across ${kpis.farms} farms` : 'No trees recorded yet'}>
          <StageBar items={stages} empty="Your farmers' tree groups will show here." />
        </ChartCard>
        <ListPanel title="Bean listings from your farmers" link={{ to: '/dashboard/beans', label: 'All beans' }} rows={[]} empty="No bean listings yet." />
      </Row>
    </>
  )
}
