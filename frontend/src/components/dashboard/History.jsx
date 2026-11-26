import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEntityHistory } from '@/hooks/useHistory'
import { fieldLabel, fieldValue, historyPhrase } from './historyText'

const SYSTEM = { initials: 'SY', avatarUrl: null }

/**
 * The History section at the end of a view drawer (DESIGN §8.2, PHASE-2-SPEC §3.15): newest first, 5 at a time with
 * "Show older"; each entry is the actor's avatar, "**Name** did what", the time, and `field` before → after.
 * Only Kaluppa gets "Open in audit log".
 * @param {{ entityType: string, entityId: string, divider?: boolean }} props
 */
export function History({ entityType, entityId, divider = true }) {
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useEntityHistory(entityType, entityId)
  const entries = data?.pages.flatMap((p) => p.items) ?? []
  const canOpen = data?.pages[0]?.meta.canOpenAuditLog

  return (
    <section aria-label="History" className="flex flex-col gap-3">
      <div className={divider ? 'flex items-baseline justify-between gap-2.5 border-t border-skeleton pt-[18px]' : 'flex items-baseline justify-between gap-2.5'}>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">History</h3>
        {canOpen && (
          <Link to={`/dashboard/audit-log?entity=${entityId}`} className="text-[12.5px] font-semibold no-underline">
            Open in audit log
          </Link>
        )}
      </div>
      {isPending ? (
        <div aria-busy="true" aria-label="Loading history" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : isError ? (
        <p role="alert" className="text-[13px] text-ink-3">
          We couldn’t load the history.{' '}
          <Button variant="link" size="sm" onClick={() => refetch()} className="h-auto p-0 text-[13px]">Try again</Button>
        </p>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-ink-3">No changes recorded yet.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="flex flex-col items-center">
                <Avatar person={{ ...(e.actor ?? SYSTEM), role: e.actorRole }} bg={e.actor ? undefined : 'bg-ink-3'} className="size-[30px] text-[10.5px]" />
                <span aria-hidden="true" className="min-h-3.5 w-0.5 flex-1 bg-sand-soft" />
              </span>
              <div className="min-w-0 flex-1 pb-4 pt-1">
                <span className="flex flex-wrap justify-between gap-x-2.5 gap-y-1 text-[13.5px]">
                  <span>
                    <strong className="font-semibold">{e.actor?.name ?? 'System'}</strong> {historyPhrase(e)}
                  </span>
                  <time dateTime={e.at} className="text-xs text-ink-4">{format(new Date(e.at), 'MMM d, yyyy · h:mm a')}</time>
                </span>
                {e.changes.length > 0 && (
                  <span className="mt-1 block text-[12.5px] text-ink-2">
                    {e.changes.map((c) => (
                      <span key={c.field} className="block break-words">
                        <code className="text-[11.5px] text-ink-3">{fieldLabel(c.field)}</code>{' '}
                        {c.from != null && (
                          <>
                            <del className="text-danger-text">{fieldValue(c.field, c.from)}</del> →{' '}
                          </>
                        )}
                        <span className="font-semibold text-tone-green-ink">{fieldValue(c.field, c.to)}</span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {hasNextPage && (
        <Button variant="outline" size="sm" loading={isFetchingNextPage} onClick={() => fetchNextPage()} className="self-start border-sand">
          Show older
        </Button>
      )}
    </section>
  )
}
