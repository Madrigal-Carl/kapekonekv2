import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconApprove, IconArchive, IconCircleX, IconHide, IconReject, IconRestore, IconTrash } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { cn } from '@/lib/cn'
import { cancelReasonRule } from '@/schemas/rules'

// DashModals.dc.html: icon and tone per variant; red = destructive, green = positive.
const VARIANTS = {
  archive: { tone: 'red', icon: IconArchive },
  restore: { tone: 'green', icon: IconRestore },
  reject: { tone: 'red', icon: IconReject, reason: true },
  cancel_sale: { tone: 'red', icon: IconCircleX, reason: true },
  remove_post: { tone: 'red', icon: IconTrash, reason: true },
  delete: { tone: 'red', icon: IconTrash },
  hide: { tone: 'red', icon: IconHide, reason: true },
  temporary_password: { tone: 'green', icon: IconApprove },
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
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        }}
        className="text-[12.5px]"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/**
 * Dashboard confirmation (DashModals.dc.html): archive, restore, reject / cancel sale / remove post (reason required, 5–300
 * characters, like the server), and the one-time temporary password with Copy. Focus starts on the safe button.
 * @param {{ open: boolean, variant: keyof VARIANTS, title: string, children?: React.ReactNode, confirmLabel?: string, cancelLabel?: string,
 *   reasonRequired?: boolean, reasonPlaceholder?: string, reasonOptions?: Array<{ value: string, label: string }>, password?: string, pending?: boolean,
 *   onClose: () => void, onConfirm?: (reason?: string, reasonCode?: string) => void }} props
 * With `reasonOptions` the reason is picked from a dropdown (OrdersFarmer.dc.html); "other" also asks for a written reason.
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
  reasonOptions,
  password,
  pending = false,
  onClose,
  onConfirm,
}) {
  const id = useId()
  const safe = useRef(null)
  const [reason, setReason] = useState('')
  const [reasonCode, setReasonCode] = useState(null)
  const v = VARIANTS[variant]
  const tone = TONES[v.tone]
  const needsReason = reasonOptions ? reasonCode === 'other' : (reasonRequired ?? Boolean(v.reason))
  const reasonOk = (!reasonOptions || Boolean(reasonCode)) && (!needsReason || cancelReasonRule.safeParse(reason.trim()).success)
  const close = () => {
    setReason('')
    setReasonCode(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} labelledBy={`${id}-t`} describedBy={children ? `${id}-d` : undefined} initialFocus={safe} className="max-w-[440px] p-[22px]">
      <span aria-hidden="true" className={cn('grid size-[42px] place-items-center rounded-full', tone.tile)}>
        <v.icon className="size-[19px]" />
      </span>
      <h2 id={`${id}-t`} className="mt-3 text-[17px] font-semibold">{title}</h2>
      {children && <p id={`${id}-d`} className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">{children}</p>}
      {password && <CopyBox value={password} />}
      {reasonOptions && (
        <div className="mt-3">
          <SearchSelect label="Reason" icon="tag" placeholder="Choose a reason" options={reasonOptions} value={reasonCode} onChange={setReasonCode} searchable={false} />
        </div>
      )}
      {needsReason && onConfirm && (
        <label className="mt-3 block">
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">{reasonOptions ? 'Tell us more · required' : 'Reason · required'}</span>
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
          <Button ref={safe} onClick={close}>Done</Button>
        ) : (
          <>
            <Button ref={safe} variant="outline" onClick={close}>{cancelLabel}</Button>
            {/* No onConfirm: the modal only explains why the action can't happen yet. */}
            {onConfirm && (
              <Button
                onClick={() => (reasonOptions ? onConfirm(needsReason ? reason.trim() : undefined, reasonCode) : onConfirm(needsReason ? reason.trim() : undefined))}
                disabled={!reasonOk}
                loading={pending}
                className={cn('min-h-[42px] py-0', tone.confirm)}
              >
                {confirmLabel}
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
