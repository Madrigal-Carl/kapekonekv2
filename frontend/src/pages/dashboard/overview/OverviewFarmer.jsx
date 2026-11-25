import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import { BarChart } from '@/components/dashboard/BarChart'
import { CapMeter } from '@/components/dashboard/CapMeter'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { ListPanel } from '@/components/dashboard/ListPanel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { NavIcon } from '@/components/dashboard/Sidebar'
import { StageBar } from '@/components/dashboard/StageBar'
import { SINGLE_SERIES, stageItems } from '@/constants/charts'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { greeting, todayInManila } from '@/lib/date'
import { useAssociationWindow } from '@/stores/associationWindow.store'
import { ChartCard, HeaderAction, KpiRow, Row } from './Overview'

const ASSOCIATION_PAGE = '/dashboard/account/association'
const BANNER_CTA = 'h-10 px-3.5 text-[13px] text-inherit hover:text-inherit'

/** The status banner per farmer state (OverviewFarmer.dc.html); approved farmers have none. */
function bannerFor({ status, association, groupManager, rejectionReason }) {
  const checker = groupManager ? `${groupManager.name}, the Group Manager,` : 'Kaluppa'
  return {
    pending: {
      tone: 'bg-tone-amber-bg text-notice-ink',
      line: 'border-notice-line',
      icon: 'clock',
      title: `Your request is with ${association?.name}`,
      text: `${checker} is checking your valid ID and proof of land ownership. Meanwhile you can record your farms and sell up to 5 kg of beans.`,
      cta: 'View request',
    },
    rejected: {
      tone: 'bg-danger-soft text-danger-text',
      line: 'border-danger-line',
      icon: 'rejected',
      title: 'Your request wasn’t approved',
      text: `Reason from ${groupManager?.name ?? 'Kaluppa'}: “${rejectionReason}”`,
      cta: 'Update and resend',
      opensWindow: true,
    },
    none: {
      tone: 'bg-crema text-ink-2',
      line: 'border-sand',
      icon: 'assoc',
      title: 'Join your association to sell without limits',
      text: 'Pick your association and upload a valid ID and proof of land ownership. Your Group Manager approves you.',
      cta: 'Join an association',
      opensWindow: true,
    },
  }[status]
}

function Banner({ banner, onOpen }) {
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-3.5 rounded-card border px-4 py-3.5', banner.tone, banner.line)}>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
        <NavIcon name={banner.icon} className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-[1_1_360px]">
        <span className="block text-sm font-semibold">{banner.title}</span>
        <span className="mt-0.5 block text-[13px] leading-[1.55]">{banner.text}</span>
      </div>
      {banner.opensWindow ? (
        <Button variant="outline" onClick={onOpen} className={cn(BANNER_CTA, banner.line)}>{banner.cta}</Button>
      ) : (
        <Button as={Link} variant="outline" to={ASSOCIATION_PAGE} className={cn(BANNER_CTA, banner.line)}>{banner.cta}</Button>
      )}
    </div>
  )
}

const kg = (n) => `${n.toLocaleString('en-PH', { maximumFractionDigits: 1 })} kg`

/** Farmer overview (OverviewFarmer.dc.html). Farms, trees, harvests and beans fill in from M9/M10; until then the tiles read zero and the charts show their empty state. */
export function OverviewFarmer({ data }) {
  const { user } = useAuth()
  const { farmer, cap, kpis, harvestByMonth, treesByStage } = data
  const banner = bannerFor(farmer)
  const showWindow = useAssociationWindow((s) => s.show)
  const openWindow = () => showWindow(farmer.status === 'rejected' ? { reason: farmer.rejectionReason, by: farmer.groupManager?.name ?? null } : null)
  const stages = stageItems(treesByStage)
  const trees = stages.reduce((s, i) => s + i.count, 0)

  return (
    <>
      <PageHeader
        eyebrow={`Farmer · ${todayInManila()}`}
        title={`${greeting()}, ${user.firstName}`}
        description="Here’s how your farms and sales are doing."
        actions={
          <>
            <HeaderAction to="/dashboard/harvests" variant="outline">Add harvest</HeaderAction>
            <HeaderAction to="/dashboard/beans" plus>Sell beans</HeaderAction>
          </>
        }
      />
      {banner && <Banner banner={banner} onOpen={openWindow} />}
      {farmer.status !== 'approved' && <CapMeter usedKg={cap.usedKg} limitKg={cap.limitKg} />}
      <KpiRow>
        <KpiTile to="/dashboard/farms" label="Farms" icon="farm" value={kpis.farms} note={kpis.farms ? undefined : 'No farms recorded yet'} />
        <KpiTile to="/dashboard/trees" label="Trees" icon="tree" value={kpis.trees.toLocaleString('en-PH')} note={kpis.trees ? undefined : 'No tree groups yet'} />
        <KpiTile to="/dashboard/harvests" label="Harvest this year" icon="harvest" value={kg(kpis.harvestThisYearKg)} note={kpis.harvestThisYearKg ? undefined : 'Nothing recorded this year'} />
        <KpiTile to="/dashboard/beans" label="Beans sold to Kaluppa" icon="beans" value={kg(kpis.beansSoldKg)} note={kpis.beansSoldKg ? undefined : 'No bean sales yet'} />
      </KpiRow>
      <Row>
        <ChartCard title="Harvest per month" sub={`Kilograms recorded across your ${kpis.farms === 1 ? 'farm' : 'farms'}, last 12 months`}>
          <BarChart labels={harvestByMonth.labels} series={[{ name: 'Harvest', color: SINGLE_SERIES, values: harvestByMonth.values }]} suffix=" kg" aria="Harvest per month in kilograms" empty="No harvests recorded yet" />
        </ChartCard>
        <ChartCard title="Trees by stage" sub={trees ? `${trees.toLocaleString('en-PH')} trees` : 'No trees recorded yet'}>
          <StageBar items={stages} empty="Add a tree group to see your trees by stage." />
        </ChartCard>
      </Row>
      <Row>
        <ListPanel title="Bean listings" link={{ to: '/dashboard/beans', label: 'All beans' }} rows={[]} empty="No bean listings yet." />
        <ListPanel title="Store orders" link={{ to: '/dashboard/orders', label: 'All orders' }} rows={[]} empty="No store orders yet." />
      </Row>
    </>
  )
}
