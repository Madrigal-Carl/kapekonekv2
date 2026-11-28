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
import { DASH_ORDER_STATUS } from '@/constants/orderStatus'
import { formatKg, formatPesoShort } from '@/lib/format'
import { BEAN_STATUS, formLabel, varietyLabel } from '@/constants/beans'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { greeting, todayInManila } from '@/lib/date'
import { useAssociationWindow } from '@/stores/associationWindow.store'
import { periodNote, periodTitle } from '@/constants/periods'
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

/** "KK-… · Complete fertilizer 14-14-14" / "2 items · ₱2,690 · cash on delivery" (OverviewFarmer.dc.html). */
const orderRow = (o) => ({
  key: o.id,
  title: `${o.orderNumber} · ${o.firstItem}`,
  sub: [
    `${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'}`,
    formatPesoShort(o.totalCentavos),
    o.paymentMethod === 'e_wallet' ? 'e-wallet' : o.fulfillmentMethod === 'delivery' ? 'cash on delivery' : 'cash on pickup',
  ].join(' · '),
  status: DASH_ORDER_STATUS[o.status].label,
  tone: DASH_ORDER_STATUS[o.status].tone,
})

/** "BN-2611-0042 · Liberica, dried cherry" / "2 kg · ₱180/kg · listed Nov 21" (OverviewFarmer.dc.html). */
const beanRow = (b) => {
  const when = b.status === 'completed' && b.completedAt ? `completed ${format(new Date(b.completedAt), 'MMM d')}` : b.status === 'approved' && b.expiresAt ? `bring by ${format(new Date(b.expiresAt), 'MMM d')}` : `listed ${format(new Date(b.createdAt), 'MMM d')}`
  return {
    key: b.id,
    title: `${b.listingNumber} · ${varietyLabel(b.variety)}, ${formLabel(b.form).toLowerCase()}`,
    sub: [formatKg(b.weightKg), `${formatPesoShort(b.pricePerKgCentavos)}/kg`, when].join(' · '),
    status: BEAN_STATUS[b.status].label.split(' · ')[0],
    tone: BEAN_STATUS[b.status].tone,
  }
}

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-PH')} ${n === 1 ? one : many}`

/** Farmer overview (OverviewFarmer.dc.html) for the picked period; farms and trees are as of now. */
export function OverviewFarmer({ data, periodBar }) {
  const { user } = useAuth()
  const { period, farmer, cap, kpis, harvest, treesByStage, beans, orders } = data
  const banner = bannerFor(farmer)
  const showWindow = useAssociationWindow((s) => s.show)
  const openWindow = () => showWindow(farmer.status === 'rejected' ? { reason: farmer.rejectionReason, by: farmer.groupManager?.name ?? null } : null)
  const stages = stageItems(treesByStage)
  const harvestNote = periodNote(period, kpis.harvest, 'harvest', 'recorded')
  const towns = kpis.farms.byMunicipality.map((m) => `${m.count} in ${m.municipality}`).join(' · ')

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
      {periodBar}
      <KpiRow>
        <KpiTile to="/dashboard/farms" label="Farms" icon="farm" value={kpis.farms.count} note={towns || 'No farms recorded yet'} />
        <KpiTile to="/dashboard/trees" label="Trees" icon="tree" value={kpis.trees.count.toLocaleString('en-PH')} note={kpis.trees.groups ? `in ${plural(kpis.trees.groups, 'tree group')}` : 'No tree groups yet'} />
        <KpiTile to="/dashboard/harvests" label="Harvest" icon="harvest" value={formatKg(kpis.harvest.kg)} note={harvestNote.text} tone={harvestNote.tone} />
        <KpiTile
          to="/dashboard/beans"
          label="Beans sold to Kaluppa"
          icon="beans"
          value={formatKg(kpis.beansSold.kg)}
          note={kpis.beansSold.waiting ? `${plural(kpis.beansSold.waiting, 'listing')} waiting for review` : 'No listings waiting for review'}
          tone={kpis.beansSold.waiting ? 'waiting' : 'muted'}
        />
      </KpiRow>
      <Row>
        <ChartCard title={periodTitle(period, ['Harvest today', 'Harvest this week', 'Harvest this month', 'Harvest per month this year'])} sub={`Kilograms recorded across your ${plural(kpis.farms.count, 'farm')}`}>
          <BarChart labels={period.labels} series={[{ name: 'Harvest', color: SINGLE_SERIES, values: harvest }]} suffix=" kg" aria="Harvest in kilograms" empty="No harvests recorded in this period" />
        </ChartCard>
        <ChartCard title="Trees by stage" sub={kpis.trees.count ? `${plural(kpis.trees.count, 'tree')} in ${plural(kpis.trees.groups, 'group')}` : 'No trees recorded yet'}>
          <StageBar items={stages} empty="Add a tree group to see your trees by stage." />
        </ChartCard>
      </Row>
      <Row>
        <ListPanel title="Bean listings" link={{ to: '/dashboard/beans', label: 'All beans' }} rows={beans.map(beanRow)} empty="No bean listings yet." />
        <ListPanel title="Store orders" link={{ to: '/dashboard/orders', label: 'All orders' }} rows={orders.map(orderRow)} empty="No store orders yet." />
      </Row>
    </>
  )
}
