import { IconCircleCheck, IconInfo, IconUsers } from '@/components/ui/icons'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useRequestToJoin } from '@/hooks/useFarmers'
import { errorMessage } from '@/lib/applyServerErrors'
import { AssociationMap } from './AssociationMap'
import { DocumentUpload } from './DocumentUpload'

const ref = (doc) => ({ url: doc.url, publicId: doc.publicId })

/**
 * "Join your association" (AssociationModal.dc.html, PHASE-2-SPEC §3.1): association + valid ID + land proof → request.
 * @param {{ open: boolean, onClose: () => void, rejection?: { reason: string, by?: string | null } | null }} props
 */
export function AssociationModal({ open, onClose, rejection = null }) {
  const id = useId()
  const options = useAssociationOptions()
  const send = useRequestToJoin()
  const [associationId, setAssociationId] = useState('')
  const [docs, setDocs] = useState({ validId: null, landProof: null })
  const [sentTo, setSentTo] = useState(null)

  const chosen = options.data?.find((o) => o.id === associationId)
  const ready = Boolean(chosen && docs.validId && docs.landProof)
  const submit = () =>
    send.mutate(
      { associationId, validId: ref(docs.validId), landProof: ref(docs.landProof) },
      { onSuccess: () => setSentTo(chosen.name), onError: (error) => toast.error(errorMessage(error)) },
    )

  return (
    <Modal open={open} onClose={onClose} labelledBy={`${id}-t`} className="max-w-[600px] self-start sm:mt-[54px]">
      {sentTo ? (
        <div className="flex flex-col items-start px-[26px] py-7">
          <span aria-hidden="true" className="grid size-[46px] place-items-center rounded-card bg-success-bg text-success">
            <IconCircleCheck className="size-6" strokeWidth={1.75} />
          </span>
          <h2 id={`${id}-t`} className="mt-3.5 text-[21px] font-semibold">Request sent</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
            We sent your documents to {sentTo}. You’ll get an email and a notification when your Group Manager decides.
          </p>
          <Button onClick={onClose} className="mt-5">Go to my dashboard</Button>
        </div>
      ) : (
        <>
          <div className="px-[26px] pt-6">
            <span aria-hidden="true" className="grid size-[46px] place-items-center rounded-card bg-crema text-roast">
              <IconUsers className="size-6" strokeWidth={1.75} />
            </span>
            <h2 id={`${id}-t`} className="mt-3.5 text-[21px] font-semibold">Join your association</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              Your Group Manager checks your documents and approves you. Until then you can still record your farms and sell up to 5 kg of beans to Kaluppa.
            </p>
            {rejection && (
              <div role="alert" className="mt-3.5 rounded-control border border-danger-line bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text">
                <strong>Not approved:</strong> “{rejection.reason}”{rejection.by && ` — ${rejection.by}`}
              </div>
            )}
          </div>
          <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 px-[26px] pb-1 pt-[18px]">
            <SearchSelect
              label="Association"
              icon="tag"
              placeholder={options.isPending ? 'Loading associations…' : 'Choose your association'}
              searchPlaceholder="Search by name or town"
              options={(options.data ?? []).map((o) => ({ value: o.id, label: `${o.name} · ${o.municipality}` }))}
              value={associationId}
              onChange={setAssociationId}
              error={options.isError ? 'We couldn’t load the associations. Close this and try again.' : undefined}
            />
            {chosen && (
              <p className="-mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-2">
                <IconInfo aria-hidden="true" className="size-4 shrink-0 text-roast" strokeWidth={1.75} />
                {chosen.groupManager
                  ? `Group Manager: ${chosen.groupManager.name} · reviews within a few days`
                  : 'No Group Manager yet — Kaluppa will review your request'}
              </p>
            )}
            {options.data?.length > 0 && <AssociationMap options={options.data} value={associationId} onChange={setAssociationId} />}
            <div className="grid gap-5 min-[720px]:grid-cols-2">
              <DocumentUpload label="Valid ID" short="valid ID" value={docs.validId} onChange={(doc) => setDocs((d) => ({ ...d, validId: doc }))} />
              <DocumentUpload label="Proof of land ownership" short="proof of land ownership" value={docs.landProof} onChange={(doc) => setDocs((d) => ({ ...d, landProof: doc }))} />
            </div>
            <p className="text-xs text-ink-3">
              Valid ID: any government ID with your name and photo. Proof of land ownership: title, tax declaration or a signed letter from the barangay.
            </p>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-b-card border-t border-sand-soft bg-cream px-[26px] py-4">
            <span className="text-xs text-ink-3">You can also do this later in Account settings → Association.</span>
            <div className="ml-auto flex gap-2.5">
              <Button variant="outline" onClick={onClose}>Skip for now</Button>
              <Button onClick={submit} disabled={!ready} loading={send.isPending} className="px-[18px]">Send request</Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
