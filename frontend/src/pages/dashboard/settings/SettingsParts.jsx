import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** A white settings card with its title and an optional line under it (SettingsKaluppa.dc.html). */
export function SettingsCard({ title, text, className, children }) {
  return (
    <section aria-label={title} className={cn('flex flex-col gap-3.5 rounded-card border border-sand bg-white p-[22px]', className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {text && <p className="-mt-2 text-[12.5px] text-ink-3">{text}</p>}
      {children}
    </section>
  )
}

/** Sticky "You have unsaved changes." bar with Discard / Save changes (submits `formId`). */
export function SaveBar({ formId, onDiscard, pending }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-sand bg-white px-[18px] py-3.5 shadow-[0_-10px_30px_-20px_rgba(43,26,18,0.4)]">
      <span className="text-[13px] text-tone-amber-ink">You have unsaved changes.</span>
      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onDiscard} disabled={pending}>Discard</Button>
        <Button type="submit" form={formId} loading={pending}>Save changes</Button>
      </div>
    </div>
  )
}
