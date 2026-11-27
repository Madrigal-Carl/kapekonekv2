import { useState } from 'react'
import { format, parseISO, startOfYear, subDays } from 'date-fns'
import { DataTable } from '@/components/dashboard/DataTable'
import { Drawer } from '@/components/dashboard/Drawer'
import { fieldLabel, fieldValue, historyPhrase } from '@/components/dashboard/historyText'
import { ExportModal } from '@/components/dashboard/ExportModal'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconDownload } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { ROLE_LABELS } from '@/constants/roles'
import { useAuditEntry, useAuditLog } from '@/hooks/useHistory'
import { useTableParams } from '@/hooks/useTableParams'
import { formatDateTime } from '@/lib/date'
import { todayKey } from '@/schemas/rules'
import { exportAuditLog } from '@/services/auditLog.service'
import { DashPage } from '../overview/Overview'

const PAGE_SIZE = 10
// Every area audit.record is called with; tones follow DESIGN §8.3 loosely so the column scans.
const AREAS = {
  associations: ['Associations', 'blue'],
  beans: ['Beans', 'blue'],
  farmers: ['Farmers', 'green'],
  farms: ['Farms', 'roast'],
  group_managers: ['Group Managers', 'blue'],
  harvests: ['Harvests', 'green'],
  hub: ['Hub', 'gray'],
  inventory: ['Inventory', 'amber'],
  orders: ['Orders', 'roast'],
  reviews: ['Reviews', 'amber'],
  settings: ['Settings', 'amber'],
  trees: ['Trees', 'green'],
  reports: ['Reports', 'gray'],
  audit_log: ['Audit log', 'gray'],
}
const ROLES = { ...ROLE_LABELS, system: 'System' }
const AVATAR_BG = { kaluppa: 'bg-espresso', group_manager: 'bg-caramel-ink', farmer: 'bg-avatar-green', buyer: 'bg-roast', system: 'bg-ink-5' }
const PERIODS = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
]
const FILTERS = [
  { key: 'area', label: 'Area', options: [{ value: '', label: 'All areas' }, ...Object.entries(AREAS).map(([value, [label]]) => ({ value, label }))] },
  { key: 'role', label: 'Role', options: [{ value: '', label: 'Everyone' }, ...Object.entries(ROLES).map(([value, label]) => ({ value, label }))] },
  { key: 'period', label: 'Period', options: PERIODS },
]

/** The Manila day a Period choice starts on (the API takes `from` as YYYY-MM-DD). */
function fromDay(period) {
  if (!period) return undefined
  const today = parseISO(todayKey())
  const day = { today, '7d': subDays(today, 6), '30d': subDays(today, 29), year: startOfYear(today) }[period]
  return day && format(day, 'yyyy-MM-dd')
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)
/** "Approved the listing" from the History phrase. */
const whatOf = (entry) => capitalize(historyPhrase(entry))
const recordOf = (entry) => entry.entityLabel || entry.entityId
const actorName = (entry) => entry.actor?.name ?? 'System'
const initialsOf = (entry) => entry.actor?.initials ?? 'SY'

function toRow(e) {
  const fields = e.changes.map((c) => fieldLabel(c.field))
  return {
    id: e.id,
    label: whatOf(e),
    when: { main: format(new Date(e.at), 'MMM d, yyyy'), sub: format(new Date(e.at), 'h:mm a') },
    actor: { name: actorName(e), sub: ROLES[e.actorRole] ?? e.actorRole, initials: initialsOf(e), avatarClassName: AVATAR_BG[e.actorRole] },
    area: { label: AREAS[e.area]?.[0] ?? e.area, tone: AREAS[e.area]?.[1] ?? 'gray' },
    what: whatOf(e),
    record: recordOf(e),
    changed: fields.length ? { main: fields.join(', '), sub: `${fields.length} ${fields.length === 1 ? 'field' : 'fields'}` } : { main: '—' },
    actions: ['view'],
  }
}

/** The diff drawer (AuditLog.dc.html): who, when, the record, and each field before → after. */
function EntryDrawer({ id, initial, onClose }) {
  const entry = useAuditEntry(id, initial)
  const e = entry.data
  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      eyebrow="Audit entry"
      title={e ? `${whatOf(e)} · ${recordOf(e)}` : 'Audit entry'}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {entry.isPending ? (
        <div aria-busy="true" aria-label="Loading entry" className="flex flex-col gap-4">
          <Skeleton className="h-11 w-60" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : entry.isError ? (
        <p role="alert" className="text-sm text-ink-2">We couldn’t find that audit entry.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar person={{ initials: initialsOf(e), avatarUrl: e.actor?.avatarUrl ?? null, role: e.actorRole }} bg={AVATAR_BG[e.actorRole]} className="size-[42px] text-[13px]" />
            <div>
              <span className="block text-[14.5px] font-semibold">{actorName(e)}</span>
              <span className="block text-[12.5px] text-ink-3">{`${ROLES[e.actorRole] ?? e.actorRole} · ${formatDateTime(e.at)}`}</span>
            </div>
          </div>
          <dl className="m-0 grid grid-cols-[160px_1fr] gap-x-[18px] gap-y-3 text-sm leading-normal max-[720px]:grid-cols-[110px_1fr]">
            {[
              ['Area', AREAS[e.area]?.[0] ?? e.area],
              ['Record', recordOf(e)],
              ['Entry ID', e.code],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="m-0 break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="-mb-2 mt-2 border-t border-skeleton pt-[18px] text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Changes</h3>
          {e.changes.length === 0 ? (
            <p className="text-[13px] text-ink-3">No fields changed.</p>
          ) : (
            <div className="overflow-hidden rounded-card border border-sand">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-cream">
                    {['Field', 'Before', 'After'].map((h) => <th key={h} scope="col" className="px-3 py-[9px] text-left font-semibold text-ink-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {e.changes.map((c) => (
                    <tr key={c.field} className="border-t border-skeleton">
                      <th scope="row" className="px-3 py-[9px] text-left font-mono text-xs font-semibold">{c.field}</th>
                      <td className="break-words bg-danger-soft px-3 py-[9px] text-danger-text"><del>{fieldValue(c.field, c.from)}</del></td>
                      <td className="break-words bg-tone-green-bg px-3 py-[9px] text-tone-green-ink">{fieldValue(c.field, c.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ink-3">Passwords and uploaded documents are never stored in the log.</p>
        </>
      )}
    </Drawer>
  )
}

/** Audit log (AuditLog.dc.html, PHASE-2-SPEC §3.12): Kaluppa only, read-only; filters, a diff drawer and CSV. */
export function AuditLog() {
  const query = useTableParams()
  const { params, set } = query
  const filters = {
    q: params.q || undefined,
    area: params.area || undefined,
    role: params.role || undefined,
    from: fromDay(params.period),
    entity: params.entity || undefined,
  }
  const list = useAuditLog({ ...filters, page: params.page, limit: PAGE_SIZE })
  const [exporting, setExporting] = useState(false)
  const close = () => set({ open: null, mode: null })

  return (
    <DashPage>
      <PageHeader
        eyebrow="System"
        title="Audit log"
        description="Who changed what and when. Read-only."
        actions={
          <Button variant="outline" onClick={() => setExporting(true)} leftIcon={<IconDownload aria-hidden="true" className="size-4" strokeWidth={2} />}>
            Export
          </Button>
        }
      />
      <ExportModal
        open={exporting}
        title="Export audit log"
        text="Download the entries in the table."
        note="Uses the search, date range and filters applied to the table right now."
        download={(format) => exportAuditLog(format, filters)}
        onClose={() => setExporting(false)}
      />
      {params.entity && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Showing one record’s entries.
          <Button variant="link" size="sm" onClick={() => set({ entity: null })} className="h-auto p-0 text-[13px]">Show every entry</Button>
        </p>
      )}
      <DataTable
        query={query}
        ariaLabel="Audit log"
        columns={[
          { key: 'when', label: 'When' },
          { key: 'actor', label: 'Who', kind: 'person' },
          { key: 'area', label: 'Area', kind: 'pill' },
          { key: 'what', label: 'What', kind: 'strong' },
          { key: 'record', label: 'Record', kind: 'mono' },
          { key: 'changed', label: 'Changed', kind: 'muted' },
        ]}
        rows={list.data?.items.map(toRow)}
        filters={FILTERS}
        onAction={(_action, row) => set({ open: row.id, mode: 'view' })}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{ title: 'No entries match', text: 'Try another area, role or period.' }}
        searchPlaceholder="Search actor, record or action"
        minWidth={1020}
        selectedId={params.open}
      />
      <EntryDrawer id={params.open || null} initial={list.data?.items.find((e) => e.id === params.open)} onClose={close} />
    </DashPage>
  )
}
