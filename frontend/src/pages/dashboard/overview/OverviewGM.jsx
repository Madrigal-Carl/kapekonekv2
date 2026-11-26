import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import { BarChart } from '@/components/dashboard/BarChart'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { ListPanel } from '@/components/dashboard/ListPanel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StageBar } from '@/components/dashboard/StageBar'
import { stageItems, VARIETIES } from '@/constants/charts'
import { BEAN_STATUS, formLabel, varietyLabel } from '@/constants/beans'
import { formatKg, formatPesoShort } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { greeting } from '@/lib/date'
import { format } from 'date-fns'
import { periodNote, periodTitle } from '@/constants/periods'
import { ChartCard, HeaderAction, KpiRow, Row } from './Overview'

const AVATARS = ['bg-caramel-ink', 'bg-avatar-green', 'bg-roast', 'bg-ink-2']
const waitingLine = (n) => (n === 0 ? 'No farmers are waiting for your approval.' : `${n} ${n === 1 ? 'farmer is' : 'farmers are'} waiting for your approval.`)

/** "Joy Lacsamana · Liberica, dried cherry" / "4 kg · ₱175/kg · capped (unapproved)" (OverviewGM.dc.html). */
const beanRow = (b) => ({
  key: b.id,
  title: `${b.farmerName} · ${varietyLabel(b.variety)}, ${formLabel(b.form).toLowerCase()}`,
  sub: [
    formatKg(b.weightKg),
    `${formatPesoShort(b.pricePerKgCentavos)}/kg`,
    b.status === 'completed' && b.completedAt
      ? `completed ${format(new Date(b.completedAt), 'MMM d')}`
      : b.status === 'approved' && b.expiresAt
        ? `bring by ${format(new Date(b.expiresAt), 'MMM d')}`
        : b.countsTowardCap
          ? 'capped (unapproved)'
          : `listed ${format(new Date(b.createdAt), 'MMM d')}`,
  ].join(' · '),
  status: BEAN_STATUS[b.status].label.split(' · ')[0],
  tone: BEAN_STATUS[b.status].tone,
})

/** Group Manager overview (OverviewGM.dc.html) for the picked period; farmers, farms and trees are as of now. */
export function OverviewGM({ data, periodBar }) {
  const { user } = useAuth()
  const { period, association, kpis, queue, harvest, treesByStage, beans } = data
  const stages = stageItems(treesByStage)
  const series = VARIETIES.map((v) => ({ name: v.label, color: v.color, values: harvest.find((s) => s.variety === v.key)?.values ?? period.labels.map(() => 0) }))
  const harvestNote = periodNote(period, kpis.harvest, 'harvest', 'recorded')

  return (
    <>
      <PageHeader
        eyebrow={`Group Manager · ${association?.name ?? 'No association yet'}`}
        title={`${greeting()}, ${user.firstName}`}
        description={waitingLine(kpis.waiting)}
        actions={association && <HeaderAction to="/dashboard/farmers?open=new" plus>Add farmer</HeaderAction>}
      />
      {periodBar}
      <KpiRow>
        <KpiTile to="/dashboard/farmers" label="Farmers" icon="farmers" value={kpis.farmers} note={kpis.waiting ? `${kpis.waiting} waiting for approval` : 'No one waiting'} tone={kpis.waiting ? 'waiting' : 'muted'} />
        <KpiTile
          to="/dashboard/farms"
          label="Farms"
          icon="farm"
          value={kpis.farms.count}
          note={kpis.farms.kaluppa ? `${kpis.farms.kaluppa} Kaluppa ${kpis.farms.kaluppa === 1 ? 'farm' : 'farms'} you manage` : kpis.farms.count ? undefined : 'No farms recorded yet'}
        />
        <KpiTile to="/dashboard/harvests" label="Harvest" icon="harvest" value={formatKg(kpis.harvest.kg)} note={harvestNote.text} tone={harvestNote.tone} />
        <KpiTile
          to="/dashboard/beans"
          label="Beans to Kaluppa"
          icon="beans"
          value={formatKg(kpis.beans.kg)}
          note={kpis.beans.waitingKg ? `${formatKg(kpis.beans.waitingKg)} waiting for review` : 'Nothing waiting for review'}
          tone={kpis.beans.waitingKg ? 'waiting' : 'muted'}
        />
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
        <ChartCard
          title={periodTitle(period, ['Association harvest today', 'Association harvest this week', 'Association harvest this month', 'Association harvest per month'])}
          sub={`All ${kpis.farmers} ${kpis.farmers === 1 ? 'farmer' : 'farmers'}, by variety`}
        >
          <BarChart labels={period.labels} series={series} suffix=" kg" aria="Association harvest by variety" empty="No harvests recorded in this period" />
        </ChartCard>
      </Row>
      <Row>
        <ChartCard title="Trees by stage" sub={kpis.trees.count ? `${kpis.trees.count.toLocaleString('en-PH')} trees across ${kpis.farms.count} ${kpis.farms.count === 1 ? 'farm' : 'farms'}` : 'No trees recorded yet'}>
          <StageBar items={stages} empty="Your farmers' tree groups will show here." />
        </ChartCard>
        <ListPanel title="Bean listings from your farmers" link={{ to: '/dashboard/beans', label: 'All beans' }} rows={beans.map(beanRow)} empty="No bean listings yet." />
      </Row>
    </>
  )
}
