import { useId, useRef } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Modal } from './Modal'

const TILES = {
  warning: 'bg-warning-bg text-warning-ink',
  danger: 'bg-danger-bg text-danger-ink',
  roast: 'bg-roast/10 text-roast',
}

/**
 * Centered confirmation (Modals.dc.html): icon tile, title, text, cancel + confirm.
 * Focus starts on the cancel button so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  icon: Icon,
  tone = 'roast',
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  pending = false,
}) {
  const id = useId()
  const cancel = useRef(null)
  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} labelledBy={`${id}-title`} describedBy={`${id}-text`} initialFocus={cancel}>
      <div className="p-7 text-center">
        {Icon && (
          <span className={cn('mx-auto grid size-12 place-items-center rounded-card', TILES[tone])}>
            <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.9} />
          </span>
        )}
        <h2 id={`${id}-title`} className="mt-4 text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={`${id}-text`} className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">
            {description}
          </p>
        )}
        <div className="mt-[22px] flex gap-2.5">
          <Button ref={cancel} variant="outline" className="flex-1" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} className="flex-1" onClick={onConfirm} pending={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
