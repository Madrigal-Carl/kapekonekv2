import { BarChart } from '@/components/dashboard/BarChart'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { ListPanel } from '@/components/dashboard/ListPanel'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SINGLE_SERIES } from '@/constants/charts'
import { BEAN_STATUS, formLabel, varietyLabel } from '@/constants/beans'
import { useAuth } from '@/hooks/useAuth'
import { greeting, todayInManila } from '@/lib/date'
import { formatKg, formatPeso } from '@/lib/format'
import { format } from 'date-fns'
import { periodNote, periodTitle } from '@/constants/periods'
import { ChartCard, HeaderAction, KpiRow, Row } from './Overview'

const wholePeso = (centavos) => formatPeso(centavos).replace(/\.00$/, '')
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function needsLine(orders, beans) {
  const parts = [orders && plural(orders, 'order'), beans && plural(beans, 'bean listing')].filter(Boolean)
  if (!parts.length) return 'Nothing needs you right now.'
  return `${parts.join(' and ')} ${orders + beans === 1 ? 'needs' : 'need'} you today.`
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

/** "Nestor Perez · 40 kg Excelsa" / "Parchment · ₱210/kg · Santa Cruz Coffee Growers" (OverviewKaluppa.dc.html). */
const beanRow = (b) => ({
  key: b.id,
  title: `${b.farmerName} · ${formatKg(b.weightKg)} ${varietyLabel(b.variety)}`,
  sub: [
    formLabel(b.form),
    `${wholePeso(b.pricePerKgCentavos)}/kg`,
    b.status === 'approved' && b.expiresAt ? `expires ${format(new Date(b.expiresAt), 'MMM d')}` : b.countsTowardCap ? 'Unapproved farmer · within 5 kg' : b.association ?? 'No association',
  ].join(' · '),
  status: b.status === 'pending' ? 'New' : BEAN_STATUS[b.status].label.split(' · ')[0],
  tone: BEAN_STATUS[b.status].tone,
})

const stockRow = (p) => ({
  key: p.id,
  title: p.name,
  sub: `${p.unit === 'kg' ? `${p.stock} kg` : `${p.stock} ${p.unit === 'pack' ? (p.stock === 1 ? 'pack' : 'packs') : p.stock === 1 ? 'pc' : 'pcs'}`} left · ${p.category === 'coffee' ? 'coffee' : 'farm supplies'}`,
  status: p.stock === 0 ? 'Out' : 'Low',
  tone: p.stock < 5 ? 'red' : 'amber',
})

/** Kaluppa overview (OverviewKaluppa.dc.html) for the picked period; orders to confirm and listings to review are as of now. */
export function OverviewKaluppa({ data, periodBar }) {
  const { user } = useAuth()
  const { period, kpis, sales, beansBought, orders, beans, lowStock } = data
  const salesNote = periodNote(period, kpis.sales, 'order', 'sold')

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
      {periodBar}
      <KpiRow>
        <KpiTile
          to="/dashboard/orders"
          label="Orders to confirm"
          icon="orders"
          value={kpis.ordersToConfirm}
          note={kpis.receiptsToCheck ? `${plural(kpis.receiptsToCheck, 'e-wallet receipt')} to check` : 'No receipts to check'}
          tone={kpis.receiptsToCheck ? 'waiting' : 'muted'}
        />
        <KpiTile to="/dashboard/reports" label="Sales" icon="peso" value={wholePeso(kpis.sales.centavos)} note={salesNote.text} tone={salesNote.tone} />
        <KpiTile to="/dashboard/beans" label="Bean listings to review" icon="beans" value={kpis.beanListingsToReview} note={`${formatKg(kpis.beanKgOffered)} offered`} tone={kpis.beanListingsToReview ? 'waiting' : 'muted'} />
        <KpiTile to="/dashboard/associations" label="Farmers" icon="farmers" value={kpis.farmers} note={`in ${plural(kpis.associations, 'association')} · ${kpis.waitingFarmers} waiting`} />
      </KpiRow>
      <Row>
        <ChartCard title={periodTitle(period, ['Store sales today', 'Store sales this week', 'Store sales this month', 'Store sales per month'])} sub="Sold orders, buyers and farmers, in pesos">
          <BarChart labels={period.labels} series={[{ name: 'Sales', color: SINGLE_SERIES, values: sales.map((c) => c / 100) }]} prefix="₱" aria="Store sales in pesos" empty="No sold orders in this period" />
        </ChartCard>
        <ChartCard title={periodTitle(period, ['Beans bought today', 'Beans bought this week', 'Beans bought this month', 'Beans bought per month'])} sub="Completed listings, in kilograms">
          <BarChart labels={period.labels} series={[{ name: 'Beans bought', color: SINGLE_SERIES, values: beansBought }]} suffix=" kg" aria="Beans bought in kilograms" empty="No beans bought in this period" />
        </ChartCard>
      </Row>
      <Row min={300}>
        <ListPanel title="Orders to act on" link={{ to: '/dashboard/orders', label: 'All orders' }} rows={orders.map(orderRow)} empty="No orders waiting for you." />
        <ListPanel title="Bean listings to review" link={{ to: '/dashboard/beans', label: 'Review queue' }} rows={beans.map(beanRow)} empty="No bean listings to review." />
        <ListPanel title="Low stock" link={{ to: '/dashboard/inventory', label: 'Inventory' }} rows={lowStock.map(stockRow)} empty="Every product is well stocked." />
      </Row>
    </>
  )
}
