import { Link } from 'react-router-dom'
import { IconTriangleAlert } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { NavIcon } from '@/components/dashboard/Sidebar'
import { useOverview } from '@/hooks/useDashboard'
import { OverviewFarmer } from './OverviewFarmer'
import { OverviewGM } from './OverviewGM'
import { OverviewKaluppa } from './OverviewKaluppa'

const VIEWS = { farmer: OverviewFarmer, group_manager: OverviewGM, kaluppa: OverviewKaluppa }

/** The page frame every dashboard page uses (DESIGN §8.1). */
export function DashPage({ children }) {
  return <main className="flex w-full flex-col gap-5 px-8 pb-14 pt-7 max-[960px]:px-4 max-[960px]:pb-10 max-[960px]:pt-5">{children}</main>
}

/** White card for a chart: title, sub-line, then the chart. */
export function ChartCard({ title, sub, children }) {
  return (
    <section className="rounded-card border border-sand bg-white px-5 py-[18px]">
      <h2 className="text-[15.5px] font-semibold">{title}</h2>
      <p className="mb-2.5 mt-0.5 text-[12.5px] text-ink-3">{sub}</p>
      {children}
    </section>
  )
}

/** Header action link styled like the screens' 42px buttons, with an optional "+" icon. */
export function HeaderAction({ to, variant = 'solid', plus, children }) {
  return (
    <Button as={Link} to={to} variant={variant}>
      {plus && <NavIcon name="plus" className="size-4" />}
      {children}
    </Button>
  )
}

export const Row = ({ min = 340, children }) => (
  <div className="grid items-start gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}>{children}</div>
)

export const KpiRow = ({ children }) => (
  <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>{children}</div>
)

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview" className="flex flex-col gap-5">
      <Skeleton className="h-[86px] w-80 max-w-full" />
      <KpiRow>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[110px]" />)}</KpiRow>
      <Row>{[0, 1].map((i) => <Skeleton key={i} className="h-[300px]" />)}</Row>
    </div>
  )
}

/** /dashboard/overview: the role's overview (OverviewFarmer / OverviewGM / OverviewKaluppa.dc.html). */
export function Overview() {
  const { data, isPending, isError, refetch } = useOverview()
  const View = data && VIEWS[data.view]
  return (
    <DashPage>
      {isPending ? (
        <OverviewSkeleton />
      ) : isError || !View ? (
        <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn't load your overview" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : (
        <View data={data} />
      )}
    </DashPage>
  )
}
