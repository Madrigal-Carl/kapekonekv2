import { format, parseISO } from 'date-fns'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLegal } from '@/hooks/useLegal'
import { cn } from '@/lib/cn'

const TABS = [
  ['terms', 'Terms and Conditions'],
  ['privacy', 'Privacy Policy'],
]
const noop = () => {}

/**
 * Terms and Conditions + Privacy Policy (TermsModal.dc.html, Change 09). The text comes from `GET /legal/current`.
 * `mode="read"`: Close / I agree; Esc and the backdrop close it. `mode="accept"`: can't be dismissed; a checkbox, then
 * Sign out / Agree and continue. 640px; full screen on phones.
 * @param {{ open: boolean, mode?: 'read'|'accept', tab?: 'terms'|'privacy', madeBy?: string|null, pending?: boolean,
 *   onClose?: () => void, onAgree: (version: number) => void, onSignOut?: () => void }} props
 */
export function TermsModal({ open, mode = 'read', tab: initialTab = 'terms', madeBy, pending, onClose = noop, onAgree, onSignOut }) {
  const id = useId()
  const accept = mode === 'accept'
  // Mount it per opening (`key`), so each link starts on its own tab.
  const [tab, setTab] = useState(initialTab)
  const [checked, setChecked] = useState(false)
  const legal = useLegal(open)
  const doc = legal.data?.[tab]
  const label = TABS.find(([key]) => key === tab)[1]
  const off = accept && !checked

  return (
    <Modal
      open={open}
      onClose={accept ? noop : onClose}
      labelledBy={`${id}-title`}
      className="flex max-h-[calc(100vh-96px)] max-w-[640px] flex-col overflow-hidden rounded-[10px] border-0 shadow-modal max-[720px]:fixed max-[720px]:inset-0 max-[720px]:max-h-none max-[720px]:max-w-none max-[720px]:rounded-none min-[721px]:mt-8 min-[721px]:self-start"
    >
      <header className="relative shrink-0 pl-6 pr-16 pt-5">
        <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{accept ? 'Before you start' : 'KapeKonek'}</span>
        <h2 id={`${id}-title`} className="m-0 mt-1.5 text-xl font-semibold tracking-[-0.01em]">{accept ? 'Agree to our terms' : label}</h2>
        {accept && (
          <p className="m-0 mt-1 text-[13.5px] leading-[1.55] text-ink-2">
            {madeBy
              ? `Your account was made for you by ${madeBy}. Read and agree to these before you start using KapeKonek.`
              : 'We updated our terms. Read and agree to them to keep using KapeKonek.'}
          </p>
        )}
        {!accept && (
          <Button variant="bare" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-0 bg-cream text-ink-2 hover:text-ink">
            <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Button>
        )}
        <div role="tablist" aria-label="Legal documents" className="-mr-10 mt-4 flex gap-1 border-b border-sand-soft">
          {TABS.map(([key, text]) => (
            <Button
              key={key}
              variant="bare"
              role="tab"
              id={`${id}-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`${id}-panel`}
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px min-h-11 border-0 border-b-2 bg-transparent px-3.5 text-sm',
                tab === key ? 'border-roast font-semibold text-ink' : 'border-transparent font-medium text-ink-3 hover:text-ink',
              )}
            >
              {text}
            </Button>
          ))}
        </div>
      </header>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-6 pb-[22px] pt-[18px] outline-none">
        {legal.isPending ? (
          <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : legal.isError ? (
          <p role="alert" className="text-sm text-ink-2">We couldn’t load the terms. Check your connection and try again.</p>
        ) : (
          <>
            <p className="m-0 mb-4 text-xs text-ink-3">{`Version ${legal.data.version}.0 · Last updated ${format(parseISO(legal.data.updatedAt), 'MMM d, yyyy')}`}</p>
            <div className="flex flex-col gap-4">
              {doc.map((section) => (
                <section key={section.heading}>
                  <h3 className="m-0 text-[14.5px] font-semibold">{section.heading}</h3>
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 40)} className="m-0 mt-1.5 text-[13.5px] leading-[1.65] text-ink-2">{p}</p>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="flex shrink-0 flex-col gap-3 border-t border-sand-soft px-6 pb-[18px] pt-3.5">
        {accept && (
          <div className="flex items-start gap-2.5">
            <input id={`${id}-agree`} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-roast" />
            <label htmlFor={`${id}-agree`} className="cursor-pointer text-[13.5px] leading-[1.55]">I’ve read and agree to the Terms and Conditions and the Privacy Policy.</label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="outline" onClick={accept ? onSignOut : onClose}>{accept ? 'Sign out' : 'Close'}</Button>
          <Button
            disabled={off || !legal.data}
            loading={pending}
            onClick={() => onAgree(legal.data.version)}
            className={cn('px-[18px]', off && 'border-sand-soft bg-sand-soft text-ink-4 opacity-100 disabled:opacity-100')}
          >
            {accept ? 'Agree and continue' : 'I agree'}
          </Button>
        </div>
      </footer>
    </Modal>
  )
}
