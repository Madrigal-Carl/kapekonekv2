import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { DocumentUpload } from '@/components/dashboard/DocumentUpload'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconAssociation, IconCheck, IconClock, IconMessage, IconMinus, IconRestore, IconTriangleAlert, IconX } from '@/components/ui/icons'
import { Input, Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useMyFarmerProfile, useReplaceDocuments, useRequestToJoin, useRequestTransfer, useWithdrawRequest, useWithdrawTransfer } from '@/hooks/useFarmers'
import { useUploadImage } from '@/hooks/useUploads'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatDate, timeAgo } from '@/lib/date'
import { formatKg, formatPhone } from '@/lib/format'
import { formatMegabytes } from '@/schemas/rules'

const CARD = 'rounded-card border border-sand bg-white'
const DOC_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
const DOCS = [
  ['validId', 'Valid ID'],
  ['landProof', 'Proof of land ownership'],
]
const BADGE = {
  approved: { label: 'Approved farmer', icon: IconCheck, className: 'bg-tone-green-bg text-tone-green-ink' },
  pending: { label: 'Waiting for approval', icon: IconClock, className: 'bg-tone-amber-bg text-tone-amber-ink' },
  rejected: { label: 'Not approved', icon: IconX, className: 'bg-tone-red-bg text-tone-red-ink' },
}
const STEP = {
  done: { icon: IconCheck, dot: 'border-success-bg bg-success text-white', title: 'text-ink' },
  wait: { icon: IconClock, dot: 'border-notice-line bg-white text-caramel', title: 'text-tone-amber-ink' },
  no: { icon: IconX, dot: 'border-danger-soft bg-logout text-white', title: 'text-tone-red-ink' },
  next: { icon: IconMinus, dot: 'border-sand-soft bg-white text-ink-4', title: 'text-ink-3' },
}
const ref = (doc) => ({ url: doc.url, publicId: doc.publicId })
const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const last = (history, actions) => history.findLast((h) => actions.includes(h.action))

/** The farmer's association (FarmerAssociation.dc.html, PHASE-2-SPEC §3.1): approved, pending, rejected or none. */
export function Association() {
  const profile = useMyFarmerProfile()
  if (profile.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <Skeleton className="h-52 rounded-card" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
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
  if (p.status === 'none') return <JoinCard profile={p} />
  return (
    <>
      <Hero profile={p} />
      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <div className="flex flex-col gap-5">
          <ManagerCard profile={p} />
          <History profile={p} />
        </div>
        <Documents profile={p} />
      </div>
      {p.status === 'approved' && <Transfer profile={p} />}
    </>
  )
}

function Hero({ profile: p }) {
  const a = p.association
  const badge = BADGE[p.status]
  const rejected = p.status === 'rejected' && last(p.history, ['reject'])
  const [confirming, setConfirming] = useState(false)
  const withdraw = useWithdrawRequest()
  const resend = useRequestToJoin()
  const onError = (error) => toast.error(errorMessage(error))
  return (
    <section aria-labelledby="as-h" className={cn(CARD, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-5 px-7 py-[26px] max-sm:px-5">
        <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-espresso text-xl font-bold tracking-[0.02em] text-caramel-light">
          {initials(a.name)}
        </span>
        <div className="min-w-0 flex-[1_1_320px]">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold', badge.className)}>
            <badge.icon aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
            {badge.label}
          </span>
          <h2 id="as-h" className="mt-2 text-2xl font-semibold tracking-[-0.01em]">{a.name}</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">
            {a.municipality}, Marinduque · {plural(a.farmers, 'farmer')} · {plural(a.farms, 'farm')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {p.status === 'approved' && (
            <Button as={Link} to="/dashboard/inbox" variant="soft" leftIcon={<IconMessage aria-hidden="true" className="size-4" strokeWidth={2} />}>
              Group chat
            </Button>
          )}
          {p.status === 'pending' && (
            <Button variant="danger-outline" onClick={() => setConfirming(true)}>
              Withdraw request
            </Button>
          )}
          {p.status === 'rejected' && (
            <Button loading={resend.isPending} onClick={() => resend.mutate({ associationId: a.id }, { onSuccess: () => toast.success('Request sent again.'), onError })}>
              Send it again
            </Button>
          )}
        </div>
      </div>
      {rejected && (
        <div role="alert" className="mx-7 mb-[22px] rounded-lg border border-danger-line bg-danger-soft px-4 py-3.5 text-[13.5px] leading-relaxed text-danger-text max-sm:mx-5">
          <strong>Not approved on {formatDate(rejected.at)}.</strong> Reason from {rejected.by ?? 'Kaluppa'}: “{p.rejectionReason}” Replace the document below and send it again.
        </div>
      )}
      <dl className="m-0 grid border-t border-sand-soft bg-cream [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {stats(p).map((s) => (
          <div key={s.k} className="border-r border-sand-soft px-7 py-4 max-sm:px-5">
            <dt className="text-xs text-ink-3">{s.k}</dt>
            <dd className={cn('m-0 mt-[3px] text-base font-semibold', s.tone)}>{s.v}</dd>
            <dd className="m-0 text-xs text-ink-3">{s.n}</dd>
          </div>
        ))}
      </dl>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => withdraw.mutate(undefined, { onSuccess: () => toast.success('Request withdrawn.'), onError })}
        pending={withdraw.isPending}
        icon={IconRestore}
        tone="danger"
        title="Withdraw your request?"
        description={`${a.name} won’t review it. You can send a new request any time; until you’re approved you can sell up to ${p.cap.capKg} kg.`}
        cancelLabel="Keep it"
        confirmLabel="Withdraw request"
        confirmVariant="danger"
      />
    </section>
  )
}

/** The 4-cell strip under the hero, per state. */
function stats(p) {
  const cap = { k: 'Selling limit', v: `${formatKg(p.cap.leftKg)} left`, n: `${p.cap.usedKg} of ${p.cap.capKg} kg used`, tone: 'text-tone-amber-ink' }
  const gm = p.association.groupManager
  if (p.status === 'approved') {
    const r = p.records
    return [
      { k: 'Selling limit', v: 'No limit', n: p.approvedAt ? `Approved ${formatDate(p.approvedAt)}` : 'Approved', tone: 'text-tone-green-ink' },
      { k: 'Your farms', v: plural(r.farms, 'farm'), n: `${+r.hectares.toFixed(2)} ha in total` },
      { k: 'Harvest this year', v: formatKg(r.harvestKgThisYear), n: `${formatKg(r.soldKgThisYear)} sold to Kaluppa` },
      { k: 'Member since', v: p.approvedAt ? new Date(p.approvedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—', n: p.association.name },
    ]
  }
  if (p.status === 'pending') {
    return [
      cap,
      { k: 'Requested', v: p.requestedAt ? formatDate(p.requestedAt) : '—', n: p.requestedAt ? timeAgo(p.requestedAt) : '' },
      { k: 'Reviewer', v: gm?.name ?? 'Kaluppa', n: gm ? 'Group Manager' : 'No Group Manager yet' },
      { k: 'Usual wait', v: '1–3 days', n: 'You’ll get an email and a notification' },
    ]
  }
  const decision = last(p.history, ['reject'])
  return [
    cap,
    { k: 'Decision', v: decision ? formatDate(decision.at) : '—', n: decision?.by ? `by ${decision.by}` : '' },
    { k: 'Fix', v: 'Your documents', n: 'Replace, then send it again', tone: 'text-tone-red-ink' },
    { k: 'Attempts', v: String(p.history.filter((h) => h.action === 'request').length), n: 'No limit on resending' },
  ]
}

function ManagerCard({ profile: p }) {
  const gm = p.association.groupManager
  return (
    <section aria-labelledby="gm-h" className={cn(CARD, 'p-6')}>
      <h2 id="gm-h" className="text-base font-semibold">{p.status === 'approved' ? 'Your Group Manager' : 'Reviewing your request'}</h2>
      {gm ? (
        <>
          <div className="mt-4 flex items-center gap-3.5">
            <span aria-hidden="true" className="grid size-[52px] shrink-0 place-items-center rounded-full bg-caramel-ink text-base font-semibold text-white">{initials(gm.name)}</span>
            <div className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-semibold">{gm.name}</span>
              <span className="block text-[12.5px] text-ink-3">Group Manager · {p.association.name}</span>
            </div>
          </div>
          <dl className="m-0 mt-4 grid grid-cols-[90px_1fr] gap-x-3.5 gap-y-2.5 text-[13.5px]">
            <dt className="text-ink-3">Phone</dt>
            <dd className="m-0 font-medium">{gm.contactNumber ? formatPhone(gm.contactNumber) : '—'}</dd>
            <dt className="text-ink-3">Email</dt>
            <dd className="m-0 break-all font-medium">{gm.email ?? '—'}</dd>
          </dl>
          <Button as={Link} to={`/dashboard/inbox?to=${gm.id}`} variant="soft" fullWidth className="mt-[18px]" leftIcon={<IconMessage aria-hidden="true" className="size-4" strokeWidth={2} />}>
            Message {gm.name.split(' ')[0]}
          </Button>
        </>
      ) : (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">This association has no Group Manager yet, so Kaluppa reviews its requests.</p>
      )}
    </section>
  )
}

/** Request history: the latest request and its outcome (FarmerAssociation.dc.html timeline). */
function steps(p) {
  const reviewer = p.association.groupManager?.name ?? 'Kaluppa'
  const request = last(p.history, ['request'])
  const added = last(p.history, ['create'])
  const sent = request
    ? { kind: 'done', t: 'Request sent', d: `${formatDate(request.at)} · valid ID and proof of land ownership` }
    : { kind: 'done', t: `Added by ${added?.by ?? 'your Group Manager'}`, d: added ? formatDate(added.at) : '' }
  if (p.status === 'approved') {
    const approve = last(p.history, ['approve'])
    return [
      sent,
      ...(approve ? [{ kind: 'done', t: `Reviewed by ${approve.by ?? reviewer}`, d: formatDate(approve.at) }] : []),
      { kind: 'done', t: 'Approved', d: `${p.approvedAt ? formatDate(p.approvedAt) : ''} · no selling limit since then` },
    ]
  }
  if (p.status === 'pending') {
    return [
      sent,
      { kind: 'wait', t: `With ${reviewer}`, d: 'Group Managers usually decide within 3 days' },
      { kind: 'next', t: 'Decision', d: 'You’ll get an email and a notification' },
    ]
  }
  const reject = last(p.history, ['reject'])
  return [
    sent,
    { kind: 'no', t: 'Not approved', d: reject ? `${formatDate(reject.at)} by ${reject.by ?? reviewer}` : '' },
    { kind: 'wait', t: 'Send it again', d: 'Replace the document, then send your request again' },
  ]
}

function History({ profile }) {
  return (
    <section aria-labelledby="hist-h" className={cn(CARD, 'p-6')}>
      <h2 id="hist-h" className="text-base font-semibold">Request history</h2>
      <ol className="m-0 mt-[18px] flex list-none flex-col p-0">
        {steps(profile).map((s, i, all) => {
          const look = STEP[s.kind]
          return (
            <li key={s.t} className="flex gap-3.5">
              <span className="flex flex-col items-center">
                <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-full border-2', look.dot)}>
                  <look.icon className="size-3.5" strokeWidth={2.4} />
                </span>
                {i < all.length - 1 && <span aria-hidden="true" className="min-h-5 w-0.5 flex-1 bg-sand-soft" />}
              </span>
              <span className={cn('pt-[3px] text-[13.5px]', i < all.length - 1 && 'pb-[18px]')}>
                <strong className={look.title}>{s.t}</strong>
                <span className="mt-0.5 block leading-normal text-ink-3">{s.d}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const DOC_STATUS = {
  approved: { label: 'Accepted', className: 'bg-tone-green-bg text-tone-green-ink' },
  pending: { label: 'In review', className: 'bg-tone-amber-bg text-tone-amber-ink' },
  // The rejection reason is free text, so we can't tell which document it means; both ask to be checked.
  rejected: { label: 'Replace this', className: 'bg-tone-red-bg text-tone-red-ink' },
}

function Documents({ profile: p }) {
  return (
    <section aria-labelledby="docs-h" className={cn(CARD, 'p-6')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id="docs-h" className="text-base font-semibold">Documents</h2>
        <span className="text-xs text-ink-3">Seen by you, your Group Manager and Kaluppa</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {DOCS.map(([key, label]) => (
          <DocumentFigure key={key} field={key} label={label} doc={p.documents[key]} status={DOC_STATUS[p.status]} />
        ))}
      </div>
      <p className="mt-3.5 text-xs text-ink-3">Photos up to 5 MB, PDFs up to 10 MB. Replacing a document after approval doesn’t change your approval.</p>
    </section>
  )
}

function DocumentFigure({ field, label, doc, status }) {
  const upload = useUploadImage('farmer_document')
  const replace = useReplaceDocuments()
  const busy = upload.isPending || replace.isPending
  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.mutate(
      { file },
      {
        onSuccess: (uploaded) =>
          replace.mutate({ [field]: ref(uploaded) }, { onSuccess: () => toast.success(`${label} replaced.`), onError: (e) => toast.error(errorMessage(e)) }),
        onError: (e) => toast.error(e.message || 'Upload failed. Try again.'),
      },
    )
  }
  const ext = doc ? (doc.kind === 'pdf' ? 'PDF' : (doc.name?.split('.').pop() ?? 'IMG').toUpperCase()) : null
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-sand">
      {/* Fixed 4:3 stage: tall or wide files are contained, never stretch the card. */}
      <div role="img" aria-label={`${label} preview`} className="grid aspect-[4/3] place-items-center overflow-hidden bg-espresso">
        {doc?.kind === 'image' ? (
          <img src={doc.url} alt="" className="size-full object-contain" />
        ) : (
          <span className="grid aspect-[3/4] h-full place-items-center bg-photo text-xs font-bold text-caramel-ink">{ext ?? 'None'}</span>
        )}
      </div>
      <figcaption className="flex flex-col gap-2 px-3.5 py-3">
        <span>
          <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
            {label}
            {doc && <span className={cn('rounded-full px-[7px] py-px text-[10.5px] font-semibold', status.className)}>{status.label}</span>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-3">{doc ? [doc.name, doc.bytes && formatMegabytes(doc.bytes)].filter(Boolean).join(' · ') : 'Not uploaded yet'}</span>
        </span>
        <span className="flex gap-3.5">
          {doc && (
            <a href={doc.url} target="_blank" rel="noreferrer" className="text-[13px] font-semibold no-underline">
              View<span className="sr-only"> {label}</span>
            </a>
          )}
          <label className={cn('relative cursor-pointer text-[13px] font-semibold text-roast focus-within:outline-2 focus-within:outline-roast', busy && 'pointer-events-none opacity-60')}>
            {busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
            <input type="file" accept={DOC_ACCEPT} aria-label={`${doc ? 'Replace' : 'Upload'} ${label.toLowerCase()}`} disabled={busy} onChange={pick} className="sr-only" />
          </label>
        </span>
      </figcaption>
    </figure>
  )
}

const TRANSFER_STEPS = (from) => [
  'Pick the new association. Its Group Manager reviews your move.',
  `You stay in ${from} until it’s approved, and you keep your approval.`,
  'After the move, your old group chat and chats with old members become read-only.',
]

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
    <section aria-labelledby="tr-h" className={cn(CARD, 'flex flex-wrap gap-8 px-7 py-[26px] max-sm:px-5')}>
      <div className="flex-[1_1_320px]">
        <h2 id="tr-h" className="text-base font-semibold">Move to another association</h2>
        <ol className="m-0 mt-4 flex list-none flex-col gap-3.5 p-0">
          {TRANSFER_STEPS(p.association.name).map((text, i) => (
            <li key={text} className="flex gap-3 text-[13.5px] leading-[1.55]">
              <span aria-hidden="true" className="grid size-[26px] shrink-0 place-items-center rounded-full bg-crema text-xs font-bold text-roast">{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>
      {p.transferRequest ? (
        <div role="status" className="flex-[1_1_380px] rounded-lg border border-notice-line bg-notice-bg p-5 text-[13.5px] leading-relaxed text-notice-ink">
          <strong className="block text-[14.5px]">Transfer to {p.transferRequest.association.name} requested</strong>
          Waiting for its Group Manager. You stay in {p.association.name} until it’s approved.
          <div className="mt-3.5">
            <Button
              variant="outline"
              size="sm"
              loading={withdraw.isPending}
              onClick={() => withdraw.mutate(undefined, { onSuccess: () => toast.success('Transfer request withdrawn.'), onError })}
              className="border-notice-line-strong text-notice-ink"
            >
              Withdraw request
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-[1_1_380px] flex-col gap-[18px] rounded-lg border border-sand-soft bg-cream p-5">
          <SearchSelect
            label="New association"
            icon="tag"
            placeholder="Choose an association"
            searchPlaceholder="Search by name or town"
            options={others.map((o) => ({ value: o.id, label: `${o.name} · ${o.municipality}${o.groupManager ? ` · ${o.groupManager.name}` : ' · no Group Manager yet'}` }))}
            value={target}
            onChange={setTarget}
          />
          <div>
            <Label htmlFor="transfer-reason">
              Reason <span className="normal-case tracking-normal text-ink-4">(optional)</span>
            </Label>
            <Input id="transfer-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. My farm is closer to Boac" className="mt-2 min-h-11" />
          </div>
          <Button onClick={send} disabled={!target} loading={request.isPending} className="self-end">Request transfer</Button>
        </form>
      )}
    </section>
  )
}

/** No association: the same join flow as the sign-in window, inline (association + both documents → request). */
function JoinCard({ profile: p }) {
  const options = useAssociationOptions()
  const send = useRequestToJoin()
  const [associationId, setAssociationId] = useState('')
  const [docs, setDocs] = useState({ validId: null, landProof: null })
  const ready = Boolean(associationId && docs.validId && docs.landProof)
  const submit = () =>
    send.mutate(
      { associationId, validId: ref(docs.validId), landProof: ref(docs.landProof) },
      { onSuccess: () => toast.success('Request sent. You’ll get an email and a notification when your Group Manager decides.'), onError: (error) => toast.error(errorMessage(error)) },
    )
  return (
    <section aria-labelledby="join-h" className={cn(CARD, 'flex flex-wrap gap-9 p-8 max-sm:p-5')}>
      <div className="flex-[1_1_300px]">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-[14px] bg-crema text-roast">
          <IconAssociation className="size-6" strokeWidth={1.75} />
        </span>
        <h2 id="join-h" className="mt-4 text-[22px] font-semibold">You’re not in an association yet</h2>
        <p className="mt-2 text-sm leading-[1.65] text-ink-2">
          Join yours to sell any amount of beans to Kaluppa, chat with co-farmers and get help from your Group Manager. Until then you can sell up to {p.cap.capKg} kg.
        </p>
        <div className="mt-4 rounded-lg border border-notice-line bg-notice-bg px-4 py-3.5 text-[13px] text-notice-ink">
          <strong>Selling limit:</strong> {p.cap.usedKg} of {p.cap.capKg} kg used
        </div>
      </div>
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-[1_1_420px] flex-col gap-[18px]">
        <SearchSelect
          label="Association"
          icon="tag"
          placeholder={options.isPending ? 'Loading associations…' : 'Choose your association'}
          searchPlaceholder="Search by name or town"
          options={(options.data ?? []).map((o) => ({ value: o.id, label: `${o.name} · ${o.municipality}` }))}
          value={associationId}
          onChange={setAssociationId}
          error={options.isError ? 'We couldn’t load the associations. Reload the page and try again.' : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DocumentUpload label="Valid ID" short="valid ID" compact value={docs.validId} onChange={(doc) => setDocs((d) => ({ ...d, validId: doc }))} />
          <DocumentUpload label="Proof of land ownership" short="proof of land ownership" compact value={docs.landProof} onChange={(doc) => setDocs((d) => ({ ...d, landProof: doc }))} />
        </div>
        <Button onClick={submit} disabled={!ready} loading={send.isPending} className="self-end px-[18px]">Send request</Button>
      </form>
    </section>
  )
}
