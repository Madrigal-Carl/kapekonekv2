import { FieldHint, Input, Label } from '@/components/ui/Input'
import { avatarFor } from '@/constants/records'
import { cn } from '@/lib/cn'
import { formatMegabytes } from '@/schemas/rules'

// Pieces every add/edit/view drawer shares (Farmers, GroupManagers, Associations .dc.html).


/** Section heading inside a drawer body. */
export function SectionTitle({ children }) {
  return <h3 className="-mb-2 mt-2 border-t border-skeleton pt-[18px] text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{children}</h3>
}

/** Big avatar + name + one muted line. */
export function PersonHeader({ id, initials, name, sub }) {
  return (
    <div className="flex items-center gap-3.5">
      <span aria-hidden="true" className={cn('grid size-[52px] shrink-0 place-items-center rounded-full text-[17px] font-semibold text-white', avatarFor(id))}>{initials}</span>
      <div className="min-w-0">
        <span className="block text-[17px] font-semibold">{name}</span>
        {sub && <span className="block text-[13px] text-ink-3">{sub}</span>}
      </div>
    </div>
  )
}

/** `[{ k, v }]` as a two-column definition list (one column on phones). */
export function DetailList({ rows }) {
  return (
    <dl className="m-0 grid grid-cols-[160px_1fr] gap-x-[18px] gap-y-3 text-sm leading-normal max-[480px]:grid-cols-1 max-[480px]:gap-y-1">
      {rows.filter(Boolean).map((row) => (
        <div key={row.k} className="contents">
          <dt className="text-ink-3">{row.k}</dt>
          <dd className="m-0 font-medium max-[480px]:mb-2">{row.v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Label + input + hint/error, wired for react-hook-form `register`. */
export function TextField({ id, label, optional, hint, error, className, ...input }) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="normal-case tracking-normal text-ink-4"> (optional)</span>}
      </Label>
      <Input id={id} className="mt-2 min-h-11 px-[13px] py-2.5" invalid={Boolean(error)} aria-describedby={`${id}-hint`} {...input} />
      <FieldHint id={`${id}-hint`} error={error} className="mt-1.5 text-xs leading-normal">{hint}</FieldHint>
    </div>
  )
}

/** A stored farmer document as a fixed 4:3 preview card with Open (FarmerReview board). */
export function DocumentFigure({ label, doc }) {
  if (!doc) {
    return (
      <figure className="m-0 grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-sand-strong p-3 text-center text-[12.5px] text-ink-3">
        {label}: not uploaded
      </figure>
    )
  }
  const pdf = doc.kind === 'pdf'
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-sand">
      {pdf ? (
        <div role="img" aria-label={`${label} preview`} className="grid aspect-[4/3] place-items-center bg-photo text-xs font-semibold text-caramel-ink">PDF</div>
      ) : (
        <img src={doc.url} alt={`${label} preview`} className="aspect-[4/3] w-full bg-photo object-cover" />
      )}
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">{label}</span>
          <span className="block truncate text-[11.5px] text-ink-3">{[doc.name, doc.bytes && formatMegabytes(doc.bytes)].filter(Boolean).join(' · ')}</span>
        </span>
        <a href={doc.url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold no-underline">Open</a>
      </figcaption>
    </figure>
  )
}

/** Small number tiles in a view drawer: `[{ k, v }]`, three or four across. */
export function StatTiles({ items }) {
  return (
    <div className={cn('grid gap-2.5', items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
      {items.map((t) => (
        <div key={t.k} className="rounded-lg border border-sand-soft bg-cream p-3">
          <span className="block text-xs text-ink-3">{t.k}</span>
          <span className="block text-xl font-semibold">{t.v}</span>
        </div>
      ))}
    </div>
  )
}
