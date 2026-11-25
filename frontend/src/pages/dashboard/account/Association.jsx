import { IconBadgeCheck, IconTriangleAlert } from '@/components/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useMyFarmerProfile, useRequestTransfer, useWithdrawTransfer } from '@/hooks/useFarmers'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDate } from '@/lib/date'
import { formatMegabytes } from '@/schemas/rules'
import { useAssociationWindow } from '@/stores/associationWindow.store'

const CARD = 'rounded-card border border-sand bg-white p-[22px]'
const OUTLINE_LINK = 'min-h-10 py-0 text-[13.5px]'
const DOCS = [
  ['validId', 'Valid ID'],
  ['landProof', 'Proof of land ownership'],
]

/** The farmer's association, documents and transfers (FarmerAssociation.dc.html, PHASE-2-SPEC §3.1–3.2). */
export function Association() {
  const profile = useMyFarmerProfile()
  if (profile.isPending) {
    return (
      <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    )
  }
  if (profile.isError) {
    return (
      <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn’t load your association" action={<Button variant="outline" onClick={() => profile.refetch()}>Try again</Button>} className="bg-white">
        Check your connection and try again.
      </EmptyState>
    )
  }
  const p = profile.data
  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
      {p.status === 'approved' ? <ApprovedCard profile={p} /> : <RequestCard profile={p} />}
      {p.status !== 'none' && <Documents documents={p.documents} />}
      {p.status === 'approved' && <Transfer profile={p} />}
    </div>
  )
}

function ApprovedCard({ profile: p }) {
  const a = p.association
  const gm = a.groupManager
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-ink-3">Your association</span>
          <h2 className="mt-0.5 text-[19px] font-semibold">{a.name}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{a.municipality}, Marinduque · {a.farmers} farmer{a.farmers === 1 ? '' : 's'}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tone-green-bg px-2.5 py-1 text-xs font-semibold text-tone-green-ink">
          <IconBadgeCheck aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Approved farmer
        </span>
      </div>
      <dl className="mt-[18px] grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5 text-[13.5px] max-[480px]:grid-cols-1 max-[480px]:gap-y-1">
        <dt className="text-ink-3">Group Manager</dt>
        <dd className="m-0 font-medium max-[480px]:mb-2">{gm ? [gm.name, gm.contactNumber].filter(Boolean).join(' · ') : 'None yet — Kaluppa looks after this association'}</dd>
        <dt className="text-ink-3">Approved</dt>
        <dd className="m-0 max-[480px]:mb-2">{p.approvedAt ? `${formatDate(p.approvedAt)}${p.approvedBy ? ` by ${p.approvedBy.name}` : ''}` : '—'}</dd>
        <dt className="text-ink-3">Selling limit</dt>
        <dd className="m-0">None. You can list any amount of beans.</dd>
      </dl>
      <div className="mt-[18px] flex flex-wrap gap-2.5">
        {gm && <Button variant="outline" to="/dashboard/inbox" className={OUTLINE_LINK}>Message {gm.name.split(' ')[0]}</Button>}
        <Button variant="outline" to="/dashboard/inbox" className={OUTLINE_LINK}>Open group chat</Button>
      </div>
    </section>
  )
}

/** Not approved yet: join, waiting, or rejected (the screen shows the approved state; these follow PHASE-2-SPEC §3.1). */
function RequestCard({ profile: p }) {
  const show = useAssociationWindow((s) => s.show)
  const gm = p.association?.groupManager
  const state = {
    none: {
      title: 'You’re not in an association yet',
      text: 'Pick your association and upload a valid ID and proof of land ownership. Until you’re approved you can sell up to 5 kg of beans to Kaluppa.',
      cta: 'Join an association',
    },
    pending: {
      title: `Your request is with ${p.association?.name}`,
      text: `${gm ? `${gm.name}, the Group Manager,` : 'Kaluppa'} is checking your documents. You’ll get an email and a notification when they decide.`,
    },
    rejected: {
      title: 'Your request wasn’t approved',
      text: `Reason from ${gm?.name ?? 'Kaluppa'}: “${p.rejectionReason}”`,
      cta: 'Update and resend',
    },
  }[p.status]
  return (
    <section className={CARD}>
      <span className="text-xs text-ink-3">Your association</span>
      <h2 className="mt-0.5 text-[19px] font-semibold">{state.title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{state.text}</p>
      {p.status === 'pending' && p.requestedAt && <p className="mt-2 text-[13px] text-ink-3">Sent {formatDate(p.requestedAt)}</p>}
      {state.cta && (
        <Button onClick={() => show(p.status === 'rejected' ? { reason: p.rejectionReason, by: gm?.name ?? null } : null)} className="mt-[18px] min-h-[42px] py-0 font-semibold">
          {state.cta}
        </Button>
      )}
    </section>
  )
}

function Documents({ documents }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">Documents</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-3">Only you, your Group Manager and Kaluppa can see these.</p>
      <ul className="m-0 mt-3.5 flex list-none flex-col gap-2.5 p-0">
        {DOCS.map(([key, label]) => {
          const doc = documents?.[key]
          return (
            <li key={key} className="flex items-center gap-3 rounded-lg border border-sand p-2.5">
              <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-md bg-photo text-[10px] font-bold text-caramel-ink">
                {doc ? (doc.kind === 'pdf' ? 'PDF' : (doc.name?.split('.').pop() ?? 'IMG').toUpperCase()) : '—'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{label}</span>
                <span className="block truncate text-xs text-ink-3">{doc ? [doc.name, doc.bytes && formatMegabytes(doc.bytes)].filter(Boolean).join(' · ') : 'Not uploaded'}</span>
              </span>
              {doc && (
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-[13px] font-semibold no-underline">
                  View<span className="sr-only"> {label}</span>
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Transfer({ profile: p }) {
  const options = useAssociationOptions()
  const request = useRequestTransfer()
  const withdraw = useWithdrawTransfer()
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const others = (options.data ?? []).filter((o) => o.id !== p.association.id)
  const onError = (error) => toast.error(errorMessage(error))
  const send = () =>
    request.mutate(
      { associationId: target, reason: reason.trim() },
      {
        onSuccess: () => {
          setTarget('')
          setReason('')
          toast.success('Transfer requested.')
        },
        onError,
      },
    )

  return (
    <section className={`${CARD} col-span-full`}>
      <div className="flex flex-wrap gap-6">
        <div className="flex-[1_1_300px]">
          <h2 className="text-base font-semibold">Move to another association</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            The new Group Manager approves the move. You stay in {p.association.name} until then. After the move, your old group chat and chats with old members become read-only.
          </p>
        </div>
        {p.transferRequest ? (
          <div role="status" className="flex-[1_1_360px] rounded-lg border border-notice-line bg-tone-amber-bg px-4 py-3.5 text-[13.5px] leading-relaxed text-notice-ink">
            <strong>Transfer requested to {p.transferRequest.association.name}.</strong> Waiting for its Group Manager. You stay in {p.association.name} until it’s approved.
            <div className="mt-2.5">
              <Button
                variant="outline"
                pending={withdraw.isPending}
                onClick={() => withdraw.mutate(undefined, { onSuccess: () => toast.success('Transfer request withdrawn.'), onError })}
                className="min-h-[38px] border-notice-line-strong px-3 py-0 text-[13px] font-semibold text-notice-ink"
              >
                Withdraw request
              </Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-[1_1_360px] flex-col gap-3">
            <SearchSelect
              label="New association"
              icon="tag"
              placeholder="Choose an association"
              searchPlaceholder="Search by name or town"
              options={others.map((o) => ({ value: o.id, label: `${o.name} · ${o.municipality}` }))}
              value={target}
              onChange={setTarget}
            />
            <div>
              <Label htmlFor="transfer-reason">
                Reason <span className="normal-case tracking-normal text-ink-4">(optional)</span>
              </Label>
              <Input id="transfer-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. My farm is closer to Boac" className="mt-1.5 min-h-[42px] py-[9px]" />
            </div>
            <Button onClick={send} disabled={!target} pending={request.isPending} className="min-h-[42px] self-start py-0 font-semibold">Request transfer</Button>
          </form>
        )}
      </div>
    </section>
  )
}
