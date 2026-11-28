import { format } from 'date-fns'
import { DataTable } from '@/components/dashboard/DataTable'
import { Drawer } from '@/components/dashboard/Drawer'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconMail } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useContactMessage, useContactMessages } from '@/hooks/useContact'
import { useTableParams } from '@/hooks/useTableParams'
import { formatDateTime } from '@/lib/date'
import { formatPhone } from '@/lib/format'
import { CONTACT_TOPICS } from '@/schemas/rules'
import { DashPage } from '../overview/Overview'

const PAGE_SIZE = 10
const FILTERS = [{ key: 'topic', label: 'Topic', options: [{ value: '', label: 'All topics' }, ...CONTACT_TOPICS.map((t) => ({ value: t, label: t }))] }]
const preview = (text) => (text.length > 70 ? `${text.slice(0, 70)}…` : text)

function toRow(m) {
  return {
    id: m.id,
    label: `Message from ${m.name}`,
    when: { main: format(new Date(m.createdAt), 'MMM d, yyyy'), sub: format(new Date(m.createdAt), 'h:mm a') },
    from: { main: m.name, sub: m.email },
    topic: m.topic,
    message: preview(m.message),
    actions: ['view'],
  }
}

/** One message: who, how to reach them, and what they wrote. Read-only; Kaluppa replies by email. */
function MessageDrawer({ id, initial, onClose }) {
  const query = useContactMessage(id, initial)
  const m = query.data
  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      eyebrow="Contact message"
      title={m ? `${m.topic} · ${m.name}` : 'Contact message'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {m && (
            <Button as="a" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`} leftIcon={<IconMail aria-hidden="true" className="size-4" strokeWidth={2} />}>
              Reply by email
            </Button>
          )}
        </>
      }
    >
      {query.isPending ? (
        <div aria-busy="true" aria-label="Loading message" className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-ink-2">We couldn’t find that message.</p>
      ) : (
        <>
          <dl className="m-0 grid grid-cols-[160px_1fr] gap-x-[18px] gap-y-3 text-sm leading-normal max-[720px]:grid-cols-[110px_1fr]">
            {[
              ['Sent', formatDateTime(m.createdAt)],
              ['Name', `${m.name}${m.signedIn ? ' (signed in)' : ''}`],
              ['Email', m.email],
              ['Contact number', m.phone ? formatPhone(m.phone) : '—'],
              ['Topic', m.topic],
              ...(m.orderNumber ? [['Order number', m.orderNumber]] : []),
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="m-0 break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="-mb-2 mt-2 border-t border-skeleton pt-[18px] text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Message</h3>
          <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{m.message}</p>
        </>
      )}
    </Drawer>
  )
}

/** Contact messages (Change 08): what people sent from the Contact us page, newest first. Kaluppa only. */
export function ContactMessages() {
  const query = useTableParams()
  const { params, set } = query
  const list = useContactMessages({ q: params.q || undefined, topic: params.topic || undefined, page: params.page, limit: PAGE_SIZE })

  return (
    <DashPage>
      <PageHeader eyebrow="System" title="Contact messages" description="Messages from the Contact us page. Each one is also emailed to the branch's Contact us email. Reply by email." />
      <DataTable
        query={query}
        ariaLabel="Contact messages"
        columns={[
          { key: 'when', label: 'Sent' },
          { key: 'from', label: 'From' },
          { key: 'topic', label: 'Topic', kind: 'strong' },
          { key: 'message', label: 'Message', kind: 'muted' },
        ]}
        rows={list.data?.items.map(toRow)}
        filters={FILTERS}
        onAction={(_action, row) => set({ open: row.id, mode: 'view' })}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{ title: 'No messages yet', text: 'Messages sent from the Contact us page show up here.' }}
        searchPlaceholder="Search name, email, order number or message"
        minWidth={820}
        selectedId={params.open}
      />
      <MessageDrawer id={params.open || null} initial={list.data?.items.find((m) => m.id === params.open)} onClose={() => set({ open: null, mode: null })} />
    </DashPage>
  )
}
