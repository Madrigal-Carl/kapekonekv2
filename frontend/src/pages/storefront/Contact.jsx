import { zodResolver } from '@hookform/resolvers/zod'
import { lazy, Suspense, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, inputClasses, Label } from '@/components/ui/Input'
import { IconArrowRight, IconCheck, IconMail, IconMapPin, IconPhone, IconSend } from '@/components/ui/icons'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useSendContactMessage } from '@/hooks/useContact'
import { useDeliveryInfo } from '@/hooks/useSettings'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS, contactSchema } from '@/schemas/rules'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))
const FIELDS = ['name', 'email', 'phone', 'topic', 'orderNumber', 'message']
const optional = <span className="normal-case tracking-normal text-ink-4"> (optional)</span>

function Field({ id, label, extra, error, children }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {extra}
      </Label>
      {children}
      <FieldHint id={`${id}-e`} error={error} />
    </div>
  )
}

/** The dark branch card, map and FAQ link (ContactUs.dc.html aside). Everything comes from Settings → Branch. */
function BranchAside() {
  const info = useDeliveryInfo()
  if (info.isPending) return <Skeleton className="h-[420px] w-full rounded-[10px]" />
  if (info.isError) return null
  const { pickup, contact } = info.data
  const phoneHref = pickup.phone && `tel:+63${pickup.phone.replace(/\s/g, '').slice(1)}`
  const rows = [
    { k: 'Address', v: pickup.address, Icon: IconMapPin },
    pickup.phone && { k: 'Phone', v: pickup.phone, href: phoneHref, Icon: IconPhone },
    contact.email && { k: 'Email', v: contact.email, href: `mailto:${contact.email}`, Icon: IconMail },
  ].filter(Boolean)
  const { lat, lng } = pickup.location
  const town = pickup.address.split(', ').at(-2)

  return (
    <>
      <section className="rounded-[10px] bg-espresso p-6 text-crema">
        <h2 className="m-0 text-[17px] font-semibold">{`${pickup.name} — ${pickup.address.split(', ').at(-3)}`}</h2>
        <ul className="m-0 mt-4 flex list-none flex-col gap-3.5 p-0 text-sm">
          {rows.map(({ k, v, href, Icon }) => (
            <li key={k} className="flex gap-3">
              <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-caramel-light/14 text-caramel-light">
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-[0.14em] text-crema/70">{k}</span>
                {href ? <a href={href} className="break-words font-medium text-crema no-underline hover:text-white">{v}</a> : <span className="break-words font-medium">{v}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-[18px] border-t border-crema/14 pt-4">
          <span className="block text-[11px] uppercase tracking-[0.14em] text-crema/70">Opening hours</span>
          <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
            {contact.hours.map((h) => (
              <div key={h.days} className="contents">
                <dt className="text-crema/70">{h.days}</dt>
                <dd className="m-0">{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="overflow-hidden rounded-[10px] border border-sand bg-white">
        <Suspense fallback={<div className="aspect-[600/440] animate-pulse bg-water" />}>
          <MapPicker value={pickup.location} pinLabel={pickup.name} ariaLabel={`Map showing ${pickup.name} in ${pickup.address.split(', ').slice(0, 2).join(', ')}`} focus={{ municipality: town }} />
        </Suspense>
        <div className="flex items-center justify-between gap-2.5 px-4 py-3">
          <span className="text-[13px] text-ink-2">Pickup orders are collected here.</span>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" className="shrink-0 text-[13px] font-semibold no-underline">
            Get directions
          </a>
        </div>
      </section>
      <Link to="/#faq" className="flex items-center justify-between gap-2.5 rounded-[10px] border border-sand bg-crema px-[18px] py-4 text-sm text-ink no-underline hover:text-ink">
        <span>
          <strong className="block">Check the FAQ first</strong>
          <span className="text-[12.5px] text-ink-2">Delivery, payment and cancelling, answered.</span>
        </span>
        <IconArrowRight aria-hidden="true" className="size-[18px] shrink-0 text-roast" strokeWidth={2} />
      </Link>
    </>
  )
}

/** Contact us (ContactUs.dc.html, Change 08): a message to Kaluppa, emailed to the branch with a copy to the sender. */
export function Contact() {
  const { user } = useAuth()
  const send = useSendContactMessage()
  const [sent, setSent] = useState(null)
  const blank = { name: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '', email: user?.email ?? '', phone: '', topic: null, orderNumber: '', message: '', website: '' }
  const { register, control, handleSubmit, reset, setError, getValues, formState: { errors, isSubmitted } } = useForm({ resolver: zodResolver(contactSchema), defaultValues: blank })
  const [topic, message = ''] = useWatch({ control, name: ['topic', 'message'] })
  const hasErrors = isSubmitted && Object.keys(errors).length > 0

  const submit = handleSubmit((body) =>
    send.mutate(body, {
      onSuccess: () => setSent({ first: body.name.split(' ')[0], email: body.email }),
      onError: (error) => {
        if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
      },
    }),
  )
  const again = () => {
    const { name, email, phone } = getValues()
    reset({ ...blank, name, email, phone })
    setSent(null)
  }

  return (
    <div className="w-full bg-white">
      <section className="bg-crema pb-14 pt-16 max-[640px]:pb-10 max-[640px]:pt-11">
        <div className="mx-auto max-w-[1180px] px-8 max-[640px]:px-4">
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Contact us</p>
          <h1 className="m-0 mt-3 max-w-[640px] text-[42px] font-medium leading-[1.1] tracking-[-0.02em] max-[640px]:text-[30px]">Questions about coffee, orders or selling? Ask Kaluppa.</h1>
          <p className="m-0 mt-3.5 max-w-[600px] text-base leading-[1.65] text-ink-2">
            Send us a message and we’ll reply by email within 1–2 business days. For an order, include your order number so we can find it fast.
          </p>
        </div>
      </section>
      <section className="pb-24 pt-14 max-[640px]:pt-8">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-start gap-8 px-8 max-[640px]:px-4">
          <div className="min-w-0 flex-[1_1_560px] rounded-[10px] border border-sand bg-white p-7 max-[640px]:p-5">
            {sent ? (
              <div role="status" className="px-1 py-6 text-center">
                <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-tone-green-bg text-tone-green-ink">
                  <IconCheck className="size-[26px]" strokeWidth={2.4} />
                </span>
                <h2 className="m-0 mt-4 text-[21px] font-semibold">Message sent</h2>
                <p className="mx-auto mt-2 max-w-[420px] text-sm leading-[1.6] text-ink-2">
                  {`Thanks, ${sent.first}. We sent a copy to `}
                  <strong>{sent.email}</strong>
                  {' and will reply within 1–2 business days.'}
                </p>
                <Button variant="outline" onClick={again} className="mt-5">Send another message</Button>
              </div>
            ) : (
              <>
                <h2 className="m-0 text-xl font-semibold">Send a message</h2>
                <p className="m-0 mt-1 text-[13.5px] text-ink-3">Fields without “optional” are required.</p>
                {hasErrors && (
                  <div role="alert" className="mt-4 rounded-[6px] border border-danger-line bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text">
                    Please fix the fields marked below.
                  </div>
                )}
                <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-[18px]">
                  {/* Honeypot: hidden from people and screen readers; bots fill it. */}
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" {...register('website')} />
                  <div className="grid grid-cols-2 gap-[18px] max-[760px]:grid-cols-1">
                    <Field id="cname" label="Full name" error={errors.name?.message}>
                      <Input id="cname" autoComplete="name" placeholder="e.g. Carla Reyes" className="mt-1.5 min-h-11" invalid={Boolean(errors.name)} aria-describedby="cname-e" {...register('name')} />
                    </Field>
                    <Field id="cemail" label="Email" error={errors.email?.message}>
                      <Input id="cemail" type="email" autoComplete="email" placeholder="name@gmail.com" className="mt-1.5 min-h-11" invalid={Boolean(errors.email)} aria-describedby="cemail-e" {...register('email')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[18px] max-[760px]:grid-cols-1">
                    <Field id="cphone" label="Contact number" extra={optional} error={errors.phone?.message}>
                      <Input id="cphone" type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" maxLength={13} className="mt-1.5 min-h-11" invalid={Boolean(errors.phone)} aria-describedby="cphone-e" {...register('phone')} />
                    </Field>
                    <Controller
                      name="topic"
                      control={control}
                      render={({ field }) => (
                        <SearchSelect label="Topic" icon="tag" placeholder="Choose a topic" searchable={false} options={CONTACT_TOPICS} value={field.value} onChange={field.onChange} ref={field.ref} error={errors.topic?.message} />
                      )}
                    />
                  </div>
                  {topic === 'An order' && (
                    <Field id="corder" label="Order number" extra={optional} error={errors.orderNumber?.message}>
                      <Input id="corder" placeholder="e.g. KK-20261118-0014" maxLength={40} className="mt-1.5 min-h-11" invalid={Boolean(errors.orderNumber)} aria-describedby="corder-e" {...register('orderNumber')} />
                    </Field>
                  )}
                  <div>
                    <Label htmlFor="cmsg">Message</Label>
                    <textarea
                      id="cmsg"
                      rows={6}
                      maxLength={CONTACT_MESSAGE_MAX}
                      placeholder="How can we help?"
                      aria-invalid={Boolean(errors.message) || undefined}
                      aria-describedby="cmsg-e cmsg-c"
                      className={cn(inputClasses, 'mt-1.5 min-h-11 resize-y leading-[1.55]')}
                      {...register('message')}
                    />
                    <div className="mt-1.5 flex justify-between gap-2.5 text-xs">
                      <span id="cmsg-e" className="text-danger-ink">{errors.message?.message}</span>
                      <span id="cmsg-c" className="shrink-0 text-ink-3">{`${message.length.toLocaleString()} / 1,000`}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* shortcut: there is no Privacy page yet; the link points home like the footer's. */}
                    <span className="max-w-[360px] text-xs leading-normal text-ink-3">
                      We use your details only to reply. See our <Link to="/">Privacy policy</Link>.
                    </span>
                    <Button type="submit" size="lg" loading={send.isPending} leftIcon={<IconSend aria-hidden="true" className="size-4" strokeWidth={2} />}>
                      Send message
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
          <aside aria-label="Kaluppa branch" className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
            <BranchAside />
          </aside>
        </div>
      </section>
    </div>
  )
}
