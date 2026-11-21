import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, inputClasses } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CANCEL_REASONS, ORDER_STATUS, paymentLabel } from '@/constants/orderStatus'
import { useCancelOrder } from '@/hooks/useOrders'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatPeso } from '@/lib/format'
import { cancelOrderSchema } from '@/schemas/order.schema'

const legend = 'p-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2'

/**
 * "Cancel this order?" with a reason (Modals.dc.html). Mount it only while open so the form starts fresh.
 * @param {{ order: object, onClose: () => void }} props
 */
export function CancelOrderDialog({ order, onClose }) {
  const id = useId()
  const cancel = useCancelOrder()
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: { reasonCode: CANCEL_REASONS[0].code, reason: '' },
  })
  const reasonCode = useWatch({ control, name: 'reasonCode' })
  const isOther = reasonCode === 'other'
  const ewallet = order.payment.method === 'e_wallet'

  const submit = handleSubmit(({ reasonCode: code, reason }) =>
    cancel.mutate(
      { id: order._id, reasonCode: code, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(`Order ${order.orderNumber} cancelled`)
          onClose()
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError, ['reasonCode', 'reason'])) toast.error(errorMessage(error))
        },
      },
    ),
  )

  return (
    <Modal open onClose={cancel.isPending ? () => {} : onClose} labelledBy={`${id}-title`} className="max-w-[760px] overflow-hidden">
      <form onSubmit={submit} noValidate>
        <div className="border-b border-sand-soft px-6 py-[18px]">
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">
            {order.orderNumber} · {ORDER_STATUS[order.status].label}
          </span>
          <h2 id={`${id}-title`} className="mt-0.5 text-lg font-semibold">
            Cancel this order?
          </h2>
        </div>
        <div className="flex flex-wrap gap-6 px-6 py-[18px]">
          <fieldset className="m-0 flex-[1_1_320px] border-0 p-0">
            <legend className={legend}>Why are you cancelling?</legend>
            <div className="mt-2.5 flex flex-col gap-2">
              {CANCEL_REASONS.map(({ code, label }) => (
                <label
                  key={code}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-[6px] px-3 py-[11px] text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-roast',
                    reasonCode === code ? 'border-2 border-roast bg-highlight' : 'border border-sand bg-white',
                  )}
                >
                  <input type="radio" value={code} className="size-[18px] accent-roast" {...register('reasonCode')} />
                  {label}
                </label>
              ))}
            </div>
            <FieldHint error={errors.reasonCode?.message} />
          </fieldset>
          <div className="flex flex-[1_1_280px] flex-col gap-3.5">
            <div>
              <label htmlFor={`${id}-reason`} className={cn(legend, 'block')}>
                Tell us more {isOther ? '(required)' : '(optional)'}
              </label>
              <textarea
                id={`${id}-reason`}
                rows={4}
                placeholder="Add details"
                aria-invalid={Boolean(errors.reason) || undefined}
                aria-describedby={`${id}-reason-hint`}
                className={cn(inputClasses, 'mt-2 resize-y py-2.5', isOther && !errors.reason && 'border-roast')}
                {...register('reason')}
              />
              <FieldHint id={`${id}-reason-hint`} error={errors.reason?.message} />
            </div>
            <p className="m-0 rounded-[6px] bg-crema p-3 text-[13px] leading-[1.6] text-ink-2">
              {ewallet ? (
                <>
                  You paid {formatPeso(order.totalCentavos)} by {paymentLabel(order)}, so it will be marked <strong>Refund pending</strong>. Kaluppa sends it back and adds the reference number to this order.
                </>
              ) : (
                <>This is a {paymentLabel(order).toLowerCase()} order, so there’s nothing to refund.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-sand-soft bg-cream px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Keep my order
          </Button>
          <Button type="submit" variant="danger" pending={cancel.isPending}>
            Cancel order
          </Button>
        </div>
      </form>
    </Modal>
  )
}
