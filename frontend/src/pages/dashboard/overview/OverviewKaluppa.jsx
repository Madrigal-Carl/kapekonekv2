import { BarChart } from '@/components/dashboard/BarChart'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { ListPanel } from '@/components/dashboard/ListPanel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SINGLE_SERIES } from '@/constants/charts'
import { useAuth } from '@/hooks/useAuth'
import { greeting, todayInManila } from '@/lib/date'
import { format, subMonths } from 'date-fns'
import { formatPeso } from '@/lib/format'
import { ChartCard, HeaderAction, KpiRow, Row } from './Overview'

const wholePeso = (centavos) => formatPeso(centavos).replace(/\.00$/, '')
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function needsLine(orders, beans) {
  const parts = [orders && plural(orders, 'order'), beans && plural(beans, 'bean listing')].filter(Boolean)
  if (!parts.length) return 'Nothing needs you right now.'
  return `${parts.join(' and ')} ${orders + beans === 1 ? 'needs' : 'need'} you today.`
}

/** "▲ 12% vs October", or null when there's nothing to compare with. */
function salesTrend(now, before, lastMonthLabel = format(subMonths(new Date(), 1), 'MMMM')) {
  if (!before) return null
  const pct = Math.round(((now - before) / before) * 100)
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${lastMonthLabel}`, tone: pct >= 0 ? 'good' : 'muted' }
}

const orderRow = (o) => ({
  key: o.id,
  title: `${o.orderNumber} · ${o.buyerName}`,
  sub: [
    o.buyerRole === 'farmer' ? 'Farmer' : 'Buyer',
    o.paymentMethod === 'e_wallet' ? `${o.paymentProvider ?? 'E-wallet'} receipt` : o.fulfillmentMethod === 'delivery' ? 'cash on delivery' : 'cash on pickup',
    wholePeso(o.totalCentavos),
  ].join(' · '),
  status: o.paymentMethod === 'e_wallet' ? 'Check receipt' : 'To confirm',
  tone: 'amber',
})

const stockRow = (p) => ({
  key: p.id,
  title: p.name,
  sub: `${p.unit === 'kg' ? `${p.stock} kg` : `${p.stock} ${p.unit === 'pack' ? (p.stock === 1 ? 'pack' : 'packs') : p.stock === 1 ? 'pc' : 'pcs'}`} left · ${p.category === 'coffee' ? 'coffee' : 'farm supplies'}`,
  status: p.stock === 0 ? 'Out' : 'Low',
  tone: p.stock < 5 ? 'red' : 'amber',
})

/** Kaluppa overview (OverviewKaluppa.dc.html). Bean listings fill in from M10. */
export function OverviewKaluppa({ data }) {
  const { user } = useAuth()
  const { kpis, salesByMonth, beansByMonth, orders, lowStock } = data
  const trend = salesTrend(kpis.salesThisMonthCentavos, kpis.salesLastMonthCentavos)

  return (
    <>
      <PageHeader
        eyebrow={`Kaluppa · ${todayInManila()}`}
        title={`${greeting()}, ${user.firstName}`}
        description={needsLine(kpis.ordersToConfirm, kpis.beanListingsToReview)}
        actions={
          <>
            <HeaderAction to="/dashboard/inventory?open=new" variant="outline" plus>Add product</HeaderAction>
            <HeaderAction to="/dashboard/beans">Review beans</HeaderAction>
          </>
        }
      />
      <KpiRow>
        <KpiTile
          to="/dashboard/orders"
          label="Orders to confirm"
          icon="orders"
          value={kpis.ordersToConfirm}
          note={kpis.receiptsToCheck ? `${plural(kpis.receiptsToCheck, 'e-wallet receipt')} to check` : 'No receipts to check'}
          tone={kpis.receiptsToCheck ? 'waiting' : 'muted'}
        />
        <KpiTile to="/dashboard/reports" label="Sales this month" icon="peso" value={wholePeso(kpis.salesThisMonthCentavos)} note={trend?.text ?? 'No sales last month to compare'} tone={trend?.tone} />
        <KpiTile to="/dashboard/beans" label="Bean listings to review" icon="beans" value={kpis.beanListingsToReview} note="0 kg offered" tone={kpis.beanListingsToReview ? 'waiting' : 'muted'} />
        <KpiTile
          to="/dashboard/associations"
          label="Farmers"
          icon="farmers"
          value={kpis.farmers}
          note={`in ${plural(kpis.associations, 'association')} · ${kpis.waitingFarmers} waiting`}
        />
      </KpiRow>
      <Row>
        <ChartCard title="Store sales per month" sub="Sold orders, buyers and farmers, in pesos">
          <BarChart labels={salesByMonth.labels} series={[{ name: 'Sales', color: SINGLE_SERIES, values: salesByMonth.values.map((c) => c / 100) }]} prefix="₱" aria="Store sales per month in pesos" empty="No sold orders in the last 6 months" />
        </ChartCard>
        <ChartCard title="Beans bought from farmers" sub="Completed listings, in kilograms">
          <BarChart labels={beansByMonth.labels} series={[{ name: 'Beans bought', color: SINGLE_SERIES, values: beansByMonth.values }]} suffix=" kg" aria="Beans bought per month in kilograms" empty="No beans bought yet" />
        </ChartCard>
      </Row>
      <Row min={300}>
        <ListPanel title="Orders to act on" link={{ to: '/dashboard/orders', label: 'All orders' }} rows={orders.map(orderRow)} empty="No orders waiting for you." />
        <ListPanel title="Bean listings to review" link={{ to: '/dashboard/beans', label: 'Review queue' }} rows={[]} empty="No bean listings to review." />
        <ListPanel title="Low stock" link={{ to: '/dashboard/inventory', label: 'Inventory' }} rows={lowStock.map(stockRow)} empty="Every product is well stocked." />
      </Row>
    </>
  )
}
