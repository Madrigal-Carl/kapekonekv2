import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible dialog: focus moves in and is trapped, Esc and the backdrop close it, focus returns on close.
 * @param {{ open: boolean, onClose: () => void, labelledBy: string, describedBy?: string, initialFocus?: React.RefObject<HTMLElement>, className?: string, children: React.ReactNode }} props
 */
export function Modal({ open, onClose, labelledBy, describedBy, initialFocus, className, children }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    ;(initialFocus?.current ?? panel.current.querySelector(FOCUSABLE) ?? panel.current).focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...panel.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return event.preventDefault()
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, initialFocus])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-espresso/50 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn('w-full max-w-[400px] rounded-card border border-sand bg-white shadow-modal outline-none', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
