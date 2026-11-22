import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { cancelReasonRule } from '@/schemas/rules'

// DashModals.dc.html: icon path and tone per variant; red = destructive, green = positive.
const VARIANTS = {
  archive: { tone: 'red', icon: 'M3 3h18v5H3zM5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4' },
  restore: { tone: 'green', icon: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5' },
  reject: { tone: 'red', icon: 'M18 6 6 18M6 6l12 12', reason: true },
  cancel_sale: { tone: 'red', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15 9l-6 6M9 9l6 6', reason: true },
  remove_post: { tone: 'red', icon: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', reason: true },
  temporary_password: { tone: 'green', icon: 'M20 6 9 17l-5-5' },
}
const TONES = {
  red: { tile: 'bg-danger-soft text-logout', confirm: 'bg-logout text-white hover:bg-danger-ink hover:text-white' },
  green: { tile: 'bg-tone-green-bg text-tone-green-ink', confirm: '' },
}

function CopyBox({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-md border border-dashed border-sand-strong bg-crema px-3.5 py-3">
      <span className="flex-1 font-mono text-[17px] font-semibold tracking-[0.04em]">{value}</span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        }}
        className="min-h-9 cursor-pointer rounded-control border border-sand-strong bg-white px-3 text-[12.5px] font-semibold text-ink"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/**
 * Dashboard confirmation (DashModals.dc.html): archive, restore, reject / cancel sale / remove post (reason required, 5–300
 * characters, like the server), and the one-time temporary password with Copy. Focus starts on the safe button.
 * @param {{ open: boolean, variant: keyof VARIANTS, title: string, children?: React.ReactNode, confirmLabel?: string, cancelLabel?: string,
 *   reasonRequired?: boolean, reasonPlaceholder?: string, password?: string, pending?: boolean, onClose: () => void, onConfirm?: (reason?: string) => void }} props
 */
export function ConfirmModal({
  open,
  variant,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  reasonRequired,
  reasonPlaceholder,
  password,
  pending = false,
  onClose,
  onConfirm,
}) {
  const id = useId()
  const safe = useRef(null)
  const [reason, setReason] = useState('')
  const v = VARIANTS[variant]
  const tone = TONES[v.tone]
  const needsReason = reasonRequired ?? Boolean(v.reason)
  const reasonOk = !needsReason || cancelReasonRule.safeParse(reason.trim()).success
  const close = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal open={open} onClose={close} labelledBy={`${id}-t`} describedBy={children ? `${id}-d` : undefined} initialFocus={safe} className="max-w-[440px] p-[22px]">
      <span aria-hidden="true" className={cn('grid size-[42px] place-items-center rounded-full', tone.tile)}>
        <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={v.icon} />
        </svg>
      </span>
      <h2 id={`${id}-t`} className="mt-3 text-[17px] font-semibold">{title}</h2>
      {children && <p id={`${id}-d`} className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">{children}</p>}
      {password && <CopyBox value={password} />}
      {needsReason && (
        <label className="mt-3 block">
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Reason · required</span>
          <textarea
            rows={3}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            className="mt-1.5 w-full resize-y rounded-control border border-sand-strong px-3 py-[9px] text-[13.5px] focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
          />
        </label>
      )}
      <div className="mt-[18px] flex justify-end gap-2.5">
        {variant === 'temporary_password' ? (
          <Button ref={safe} onClick={close} className="min-h-[42px] py-0">Done</Button>
        ) : (
          <>
            <Button ref={safe} variant="outline" onClick={close} className="min-h-[42px] py-0 font-semibold">{cancelLabel}</Button>
            <Button
              onClick={() => onConfirm?.(needsReason ? reason.trim() : undefined)}
              disabled={!reasonOk}
              pending={pending}
              className={cn('min-h-[42px] py-0', tone.confirm)}
            >
              {confirmLabel}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
