import { useId, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { IconSave } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'

/**
 * "Save these changes?" (FarmEditConfirm.dc.html): each changed field as label: before → after, the History note,
 * Keep editing / Save changes. Focus starts on Keep editing. Used by every edit of an existing record.
 * @param {{ open: boolean, changes: Array<{ key: string, label: string, from: string, to: string, sensitive?: boolean }>,
 *   pending?: boolean, onClose: () => void, onConfirm: () => void }} props
 */
export function ConfirmChangesModal({ open, changes, pending = false, onClose, onConfirm }) {
  const id = useId()
  const keep = useRef(null)
  return (
    <Modal open={open} onClose={onClose} labelledBy={`${id}-t`} describedBy={`${id}-d`} initialFocus={keep} className="max-w-[460px] p-6">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-crema text-roast">
        <IconSave className="size-5" />
      </span>
      <h2 id={`${id}-t`} className="mt-3.5 text-lg font-semibold">Save these changes?</h2>
      <p id={`${id}-d`} className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">You changed:</p>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {changes.map((c) => (
          <li key={c.key} className="flex flex-wrap items-baseline gap-1.5 rounded-md border border-sand-soft bg-cream px-2.5 py-2 text-[13px] wrap-anywhere">
            <strong>{c.label}</strong>
            {c.sensitive ? (
              <span className="font-semibold text-tone-green-ink">changed</span>
            ) : (
              <>
                <span className="text-danger-ink line-through">{c.from}</span>
                <span aria-label="to" className="text-ink-3">→</span>
                <span className="font-semibold text-tone-green-ink">{c.to}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[12.5px] text-ink-3">This is recorded in the History and the audit log.</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button ref={keep} variant="outline" onClick={onClose}>Keep editing</Button>
        <Button onClick={onConfirm} loading={pending}>Save changes</Button>
      </div>
    </Modal>
  )
}

/** The note beside a disabled Save when an edit hasn't changed anything yet. */
export function NoChangesNote({ id }) {
  return <span id={id} className="mr-auto self-center text-[12.5px] text-ink-3">No changes yet</span>
}
