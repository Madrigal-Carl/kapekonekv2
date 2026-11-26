import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { useId } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

const WIDTHS = { 600: 'max-w-[600px]', 640: 'max-w-[640px]', 720: 'max-w-[720px]' }

/**
 * Right-side drawer for add / edit / view (DESIGN §8.2): roomy header, scrolling body with 24px between blocks,
 * cream footer with actions on the right. Focus is trapped and Esc closes it (Modal).
 * @param {{ open: boolean, title: React.ReactNode, eyebrow?: string, onClose: () => void, footer?: React.ReactNode, width?: 600|640|720, children?: React.ReactNode }} props
 */
export function Drawer({ open, title, eyebrow, onClose, footer, width = 600, children }) {
  const titleId = useId()
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} placement="right" className={cn(WIDTHS[width], 'max-[720px]:max-w-none max-[720px]:border-l-0')}>
      <div className="flex items-start justify-between gap-3 border-b border-sand-soft px-8 pb-5 pt-[22px] max-[720px]:px-[18px]">
        <div className="min-w-0">
          {eyebrow && <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{eyebrow}</span>}
          <h2 id={titleId} className="mt-1 text-xl font-semibold leading-[1.3]">{title}</h2>
        </div>
        <Button variant="ghost" iconOnly aria-label="Close" onClick={onClose} className="size-10 text-ink-3 hover:bg-crema hover:text-ink-3">
          <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 pb-8 pt-7 max-[720px]:px-[18px] max-[720px]:pb-7 max-[720px]:pt-5">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-sand-soft bg-cream px-8 py-[18px] max-[720px]:px-[18px] max-[720px]:[&>*]:flex-auto">{footer}</div>}
    </Modal>
  )
}
