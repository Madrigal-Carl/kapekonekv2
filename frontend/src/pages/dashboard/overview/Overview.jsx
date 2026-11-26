import { Link, useSearchParams } from 'react-router-dom'
import { IconTriangleAlert } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { NavIcon } from '@/components/dashboard/Sidebar'
import { DateRangeSegmented } from '@/components/dashboard/DateRangeSegmented'
import { PERIODS } from '@/constants/periods'
import { useAuth } from '@/hooks/useAuth'
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

/** Cards at least `min` px wide, as many per line as fit; `maxCols` caps that (a column is then never narrower than its share). */
export function Row({ min = 340, maxCols, children }) {
  const floor = maxCols ? `max(${min}px, calc((100% - ${(maxCols - 1) * 16}px) / ${maxCols}))` : `${min}px`
  return <div className="grid items-start gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${floor}, 100%), 1fr))` }}>{children}</div>
}

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

const PERIOD_KEY = (userId) => `kk:overview-period:${userId}`
const remembered = (userId) => {
  try {
    return localStorage.getItem(PERIOD_KEY(userId))
  } catch {
    return null
  }
}

/** `?period=` wins; otherwise the period this user picked last (localStorage), else this month. */
function usePeriod() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const valid = (p) => PERIODS.some((x) => x.key === p)
  const fromUrl = params.get('period')
  const period = valid(fromUrl) ? fromUrl : valid(remembered(user?.id)) ? remembered(user?.id) : 'month'
  const pick = (next) => {
    try {
      localStorage.setItem(PERIOD_KEY(user?.id), next)
    } catch {
      // private mode or blocked storage: the URL still carries it
    }
    setParams((p) => {
      p.set('period', next)
      return p
    }, { replace: true })
  }
  return [period, pick]
}

/** /dashboard/overview: the role's overview (OverviewFarmer / OverviewGM / OverviewKaluppa.dc.html) for a period. */
export function Overview() {
  const [period, setPeriod] = usePeriod()
  const { data, isPending, isError, refetch } = useOverview(period)
  const View = data && VIEWS[data.view]
  const periodBar = <DateRangeSegmented value={period} rangeText={data?.period?.key === period ? data.period.rangeText : undefined} onChange={setPeriod} />
  return (
    <DashPage>
      {isPending ? (
        <OverviewSkeleton />
      ) : isError || !View ? (
        <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn't load your overview" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : (
        <View data={data} periodBar={periodBar} />
      )}
    </DashPage>
  )
}
