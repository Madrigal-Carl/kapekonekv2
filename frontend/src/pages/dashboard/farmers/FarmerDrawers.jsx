import { Link } from 'react-router-dom'
import { IconCheck } from '@/components/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { DetailList, DocumentFigure, PersonHeader, SectionTitle } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useApproveFarmer, useApproveTransfer, useRejectFarmer, useRejectTransfer } from '@/hooks/useFarmers'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDate } from '@/lib/date'
import { FARMER_STATUS as STATUS } from '@/constants/records'
import { cancelReasonRule } from '@/schemas/rules'

const subline = (f) => [`@${f.username}`, f.contactNumber].filter(Boolean).join(' · ')

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-[52px] w-2/3 rounded-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="aspect-[4/3] w-1/2" />
    </div>
  )
}

/**
 * Approve or reject a join request, or a transfer into this association (Farmers.dc.html, FarmerReview board).
 * @param {{ open: boolean, farmer: object | undefined, transfer: boolean, onClose: () => void }} props
 */
export function FarmerReview({ open, farmer, transfer, onClose }) {
  const approve = useApproveFarmer()
  const reject = useRejectFarmer()
  const approveMove = useApproveTransfer()
  const rejectMove = useRejectTransfer()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const reasonCheck = cancelReasonRule.safeParse(reason)
  const first = farmer?.firstName ?? ''
  const close = () => {
    setRejecting(false)
    setReason('')
    setTouched(false)
    onClose()
  }
  const done = (message) => () => {
    toast.success(message)
    close()
  }
  const onError = (error) => toast.error(errorMessage(error))

  const doApprove = () =>
    transfer
      ? approveMove.mutate(farmer.id, { onSuccess: done(`${farmer.name} moved to ${farmer.transferRequest.association.name}.`), onError })
      : approve.mutate(farmer.id, { onSuccess: done(`${farmer.name} is approved and can now sell without a limit.`), onError })
  const doReject = () => {
    setTouched(true)
    if (!reasonCheck.success) return
    const body = { id: farmer.id, reason: reasonCheck.data }
    const message = farmer.email ? `Request rejected. ${first} was emailed your reason.` : `Request rejected. ${first} sees your reason in their dashboard.`
    ;(transfer ? rejectMove : reject).mutate(body, { onSuccess: done(message), onError })
  }

  const footer = farmer && (rejecting ? (
    <>
      <Button variant="outline" onClick={() => setRejecting(false)} className="min-h-[42px] py-0 font-semibold">Back</Button>
      <Button variant="danger" onClick={doReject} loading={reject.isPending || rejectMove.isPending}>Reject request</Button>
    </>
  ) : (
    <>
      <Button variant="outline" onClick={() => setRejecting(true)} className="min-h-[42px] py-0 font-semibold text-logout">Reject</Button>
      <Button variant="success" onClick={doApprove} loading={approve.isPending || approveMove.isPending}>
        <IconCheck aria-hidden="true" className="size-4" strokeWidth={2.25} />
        {transfer ? 'Approve transfer' : 'Approve farmer'}
      </Button>
    </>
  ))

  return (
    <Drawer open={open} eyebrow={transfer ? 'Transfer request' : 'Approval request'} title={farmer ? `Review ${first}’s request` : 'Review request'} onClose={close} footer={footer}>
      {!farmer ? (
        <Loading />
      ) : (
        <>
          <PersonHeader id={farmer.id} initials={farmer.initials} name={farmer.name} sub={subline(farmer)} />
          {transfer && (
            <div role="note" className="rounded-control bg-tone-blue-bg px-3 py-2.5 text-[13px] text-tone-blue-ink">
              Transfer request from <strong>{farmer.association?.name}</strong>.{farmer.approvedAt && ` Already approved there on ${formatDate(farmer.approvedAt)}.`}
            </div>
          )}
          <SectionTitle>Request</SectionTitle>
          <DetailList
            rows={[
              { k: 'Requested', v: formatDate(transfer ? farmer.transferRequest.requestedAt : (farmer.requestedAt ?? farmer.createdAt)) },
              transfer && farmer.transferRequest.reason && { k: 'Reason', v: farmer.transferRequest.reason },
              { k: 'Contact', v: farmer.contactNumber },
              { k: 'Email', v: farmer.email ?? 'No email' },
            ]}
          />
          <SectionTitle>Documents</SectionTitle>
          <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
            <DocumentFigure label="Valid ID" doc={farmer.documents?.validId} />
            <DocumentFigure label="Proof of land ownership" doc={farmer.documents?.landProof} />
          </div>
          {rejecting && (
            <div>
              <label htmlFor="reject-reason" className="block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-tone-red-ink">Reason for rejecting · required</label>
              <textarea
                id="reject-reason"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !reasonCheck.success ? true : undefined}
                aria-describedby="reject-reason-hint"
                placeholder="e.g. The proof of land ownership is blurry. Please upload a clearer photo."
                className="mt-1.5 w-full resize-y rounded-control border border-danger-line px-3 py-[9px] text-sm focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
              />
              <span id="reject-reason-hint" className={touched && !reasonCheck.success ? 'mt-1 block text-xs text-danger-ink' : 'mt-1 block text-xs text-ink-3'}>
                {touched && !reasonCheck.success ? reasonCheck.error.issues[0].message : 'The farmer sees this in an email and in their dashboard.'}
              </span>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}

/**
 * A farmer's record (Farmers.dc.html view drawer): status, dates, farms, Message and Edit.
 * @param {{ open: boolean, farmer: object | undefined, canEdit: boolean, onEdit: () => void, onClose: () => void }} props
 */
export function FarmerView({ open, farmer, canEdit, onEdit, onClose }) {
  const footer = farmer && (
    <>
      <Button as={Link} variant="outline" to={`/dashboard/inbox?to=${farmer.id}`}>Message</Button>
      {canEdit && <Button onClick={onEdit}>Edit</Button>}
    </>
  )
  return (
    <Drawer open={open} eyebrow="Farmer" title={farmer?.name ?? 'Farmer'} onClose={onClose} footer={footer}>
      {!farmer ? (
        <Loading />
      ) : (
        <>
          <PersonHeader id={farmer.id} initials={farmer.initials} name={farmer.name} sub={subline(farmer)} />
          <DetailList
            rows={[
              { k: 'Status', v: STATUS[farmer.status]?.[0] ?? 'Not in an association' },
              { k: 'Association', v: farmer.association?.name },
              farmer.status === 'approved' && { k: 'Approved', v: formatDate(farmer.approvedAt ?? farmer.since) },
              farmer.status === 'rejected' && { k: 'Reason', v: farmer.rejectionReason },
              { k: 'Email', v: farmer.email ?? 'No email' },
            ]}
          />
          <SectionTitle>Farms</SectionTitle>
          {/* shortcut: farms arrive with M9 (farms, trees, harvests); this list fills in then. */}
          <p className="text-[13px] text-ink-3">No farms recorded yet.</p>
        </>
      )}
    </Drawer>
  )
}
