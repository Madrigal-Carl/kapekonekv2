import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NavIcon } from './Sidebar'

const NOTE_TONE = { muted: 'text-ink-3', good: 'text-tone-green-ink', waiting: 'text-tone-amber-ink' }

/**
 * Overview KPI tile: a link with label, icon, big value and a note.
 * @param {{ to: string, label: string, icon: string, value: React.ReactNode, note?: string, tone?: 'muted'|'good'|'waiting' }} props
 */
export function KpiTile({ to, label, icon, value, note, tone = 'muted' }) {
  return (
    <Link to={to} className="flex flex-col gap-1 rounded-card border border-sand bg-white px-[18px] py-4 text-ink no-underline hover:border-sand-strong hover:text-ink">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-md bg-crema text-roast">
          <NavIcon name={icon} className="size-4" />
        </span>
      </span>
      <span className="text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">{value}</span>
      {note && <span className={cn('text-xs', NOTE_TONE[tone])}>{note}</span>}
    </Link>
  )
}
