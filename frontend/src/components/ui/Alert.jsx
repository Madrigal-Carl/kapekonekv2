import { IconCheck, IconTriangleAlert } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const TONES = {
  success: { box: 'border-positive-line bg-positive-bg text-positive-ink text-[13px]', Icon: IconCheck, role: 'status' },
  danger: { box: 'border-danger-line bg-danger-soft text-danger-text text-[12.5px]', Icon: IconTriangleAlert, role: 'alert' },
}

/** Inline message box from the auth screens (sent-link status, expired-link error). */
export function Alert({ tone = 'success', className, children }) {
  const { box, Icon, role } = TONES[tone]
  return (
    <div role={role} className={cn('flex items-start gap-2.5 rounded-[6px] border px-3.5 py-3', box, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </div>
  )
}
