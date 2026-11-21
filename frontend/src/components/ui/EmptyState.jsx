import { cn } from '@/lib/cn'

/** Dashed box with an icon tile, title, text and an optional action (Products "No coffee matches"). */
export function EmptyState({ icon: Icon, title, children, action, tone = 'neutral', className }) {
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cn('rounded-card border border-dashed border-sand-strong px-6 py-14 text-center', className)}>
      {Icon && (
        <span className={cn('mx-auto grid size-12 place-items-center rounded-card', tone === 'error' ? 'bg-danger-soft text-danger-ink' : 'bg-crema text-roast')}>
          <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
        </span>
      )}
      <h2 className="mt-4 text-[17px] font-semibold">{title}</h2>
      {children && <p className="mt-1.5 text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
