import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { StatusPill } from './StatusPill'

// Row action icons and labels (DataTable.dc.html).
const ACTIONS = {
  view: ['View', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  edit: ['Edit', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  archive: ['Archive', 'M3 3h18v5H3zM5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4'],
  restore: ['Restore', 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5'],
  approve: ['Approve', 'M20 6 9 17l-5-5'],
  reject: ['Reject', 'M18 6 6 18M6 6l12 12'],
  review: ['Review', 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  manage: ['Manage', 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  trees: ['Trees', 'M12 22v-6M12 2 5 11h4l-5 5h16l-5-5h4z'],
  cancel: ['Cancel', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15 9l-6 6M9 9l6 6'],
  hide: ['Hide', 'M21 15V5a2 2 0 0 0-2-2H9M2 2l20 20M3.6 3.6A2 2 0 0 0 3 5v16l4-4h10'],
  unhide: ['Show again', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM9 10l2 2 4-4'],
  reply: ['Reply', 'M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4'],
}
const DESTRUCTIVE = new Set(['archive', 'reject', 'cancel', 'hide'])

/** Page buttons: all when ≤ 7, else first, last and the current ± 1 with gaps. */
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const keep = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  return keep.flatMap((n, i) => (i && n - keep[i - 1] > 1 ? ['…', n] : [n]))
}

function Cell({ column, value }) {
  const kind = column.kind ?? 'text'
  if (column.render) return column.render(value)
  if (value == null || value === '') return <span className="text-ink-4">—</span>
  if (kind === 'person') {
    return (
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold text-white', value.avatarClassName ?? 'bg-roast')}>
          {value.initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{value.name}</span>
          {value.sub && <span className="text-xs text-ink-3">{value.sub}</span>}
        </span>
      </span>
    )
  }
  if (kind === 'pill') return <StatusPill tone={value.tone}>{value.label}</StatusPill>
  const main = typeof value === 'object' ? value.main : value
  const sub = typeof value === 'object' ? value.sub : null
  return (
    <span className="flex flex-col">
      <span className={cn(kind === 'strong' && 'font-semibold', kind === 'mono' && 'font-mono', kind === 'muted' && 'text-ink-3')}>{main}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </span>
  )
}

/**
 * Every management list (DataTable.dc.html, DESIGN §8.2): search left; "Clear filters", then Status, then plain dropdowns right;
 * person / pill / two-line / mono / strong / muted cells; icon row actions; "Showing a–b of n" and numbered pages.
 * State lives in the URL through `query` (useTableParams). Below 640px rows become cards.
 * @param {{
 *   query: ReturnType<typeof import('@/hooks/useTableParams').useTableParams>,
 *   columns: Array<{ key: string, label: string, kind?: 'person'|'pill'|'two-line'|'mono'|'strong'|'muted'|'text', align?: 'left'|'right', wrap?: boolean, render?: (value: any) => React.ReactNode }>,
 *   rows?: Array<{ id: string, label?: string, actions?: string[] } & Record<string, any>>,
 *   status?: { label: string, options: Array<{ value: string, label: string }> },
 *   filters?: Array<{ key: string, label: string, options: Array<{ value: string, label: string }>, disabled?: boolean }>,
 *   actions?: string[] | ((row: object) => string[]), onAction?: (action: string, row: object) => void,
 *   total?: number, pageSize?: number, loading?: boolean, error?: unknown, onRetry?: () => void,
 *   emptyState?: { title: string, text?: string }, searchPlaceholder?: string, minWidth?: number, selectedId?: string, ariaLabel?: string,
 * }} props
 */
export function DataTable({
  query,
  columns,
  rows,
  status,
  filters = [],
  actions = [],
  onAction,
  total = 0,
  pageSize = 10,
  loading = false,
  error,
  onRetry,
  emptyState = { title: 'Nothing here yet' },
  searchPlaceholder = 'Search',
  minWidth = 760,
  selectedId,
  ariaLabel = 'Records',
}) {
  const { params, set, clear } = query
  const [draft, setDraft] = useState(params.q)
  const dropdowns = [...(status ? [{ key: 'status', ...status }] : []), ...filters]
  const filtered = dropdowns.some((d) => (params[d.key] ?? '') !== (d.options[0]?.value ?? ''))
  const page = params.page
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const list = rows ?? []
  const empty = !loading && !error && list.length === 0
  const searching = Boolean(params.q) || filtered

  return (
    <section aria-label={ariaLabel} className="rounded-card border border-sand bg-white text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="relative max-w-[360px] flex-[1_1_260px]">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" strokeWidth={2} />
          <input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              set({ q: e.target.value.trim() })
            }}
            className="min-h-10 w-full rounded-control border border-sand-strong bg-white py-2 pl-9 pr-3 text-[13.5px] focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
          />
        </div>
        {dropdowns.length > 0 && (
          <div role="group" aria-label="Filters" className="flex flex-wrap items-center justify-end gap-2.5">
            {filtered && (
              <button type="button" onClick={clear} className="min-h-10 cursor-pointer border-0 bg-transparent px-2.5 text-[13px] font-semibold text-roast">
                Clear filters
              </button>
            )}
            {dropdowns.map((d) => (
              <SearchSelect
                key={d.key}
                aria-label={d.label}
                icon="tag"
                size="sm"
                searchable={false}
                disabled={d.disabled}
                options={d.options}
                value={params[d.key] ?? d.options[0]?.value ?? ''}
                onChange={(value) => set({ [d.key]: value })}
                className={d.key === 'status' ? 'w-[200px]' : 'w-[190px]'}
              />
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto border-t border-sand-soft">
        <table aria-busy={loading || undefined} className="w-full border-collapse text-[13.5px] max-[640px]:block max-[640px]:!min-w-0" style={{ minWidth }}>
          <thead className="max-[640px]:hidden">
            <tr className="bg-cream">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('whitespace-nowrap border-b border-sand-soft px-3.5 py-[11px] text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.label}
                </th>
              ))}
              <th scope="col" className="border-b border-sand-soft px-3.5 py-[11px] text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Actions</th>
            </tr>
          </thead>
          <tbody className="max-[640px]:block">
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-skeleton max-[640px]:block">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3.5 py-3 max-[640px]:block">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                  <td className="px-3.5 py-3 max-[640px]:hidden" />
                </tr>
              ))}
            {!loading &&
              list.map((row) => {
                const keys = row.actions ?? (typeof actions === 'function' ? actions(row) : actions)
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-skeleton max-[640px]:m-3 max-[640px]:block max-[640px]:rounded-card max-[640px]:border max-[640px]:border-sand max-[640px]:p-1',
                      row.id === selectedId ? 'bg-highlight' : 'bg-white',
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        data-label={c.label}
                        className={cn(
                          'px-3.5 py-3 align-middle',
                          c.wrap ? 'whitespace-normal' : 'whitespace-nowrap',
                          c.align === 'right' && 'text-right',
                          'max-[640px]:flex max-[640px]:items-start max-[640px]:justify-between max-[640px]:gap-4 max-[640px]:whitespace-normal max-[640px]:py-2 max-[640px]:text-right',
                          'max-[640px]:before:shrink-0 max-[640px]:before:pt-0.5 max-[640px]:before:text-left max-[640px]:before:text-[11px] max-[640px]:before:font-semibold max-[640px]:before:uppercase max-[640px]:before:tracking-[0.08em] max-[640px]:before:text-ink-3 max-[640px]:before:content-[attr(data-label)]',
                        )}
                      >
                        <Cell column={c} value={row[c.key]} />
                      </td>
                    ))}
                    <td data-label="Actions" className="whitespace-nowrap px-2.5 py-2 text-right max-[640px]:flex max-[640px]:justify-end max-[640px]:border-t max-[640px]:border-sand-soft">
                      {keys.map((key) => (
                        <button
                          key={key}
                          type="button"
                          aria-label={`${ACTIONS[key][0]} ${row.label ?? ''}`.trim()}
                          title={ACTIONS[key][0]}
                          onClick={() => onAction?.(key, row)}
                          className={cn(
                            'inline-grid size-9 cursor-pointer place-items-center rounded-control border-0 bg-transparent hover:bg-crema',
                            DESTRUCTIVE.has(key) ? 'text-logout' : key === 'approve' ? 'text-success-ink' : 'text-ink-2',
                          )}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d={ACTIONS[key][1]} />
                          </svg>
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
        {error && !loading && (
          <div role="alert" className="px-4 py-12 text-center">
            <p className="text-sm font-semibold">We couldn’t load this list</p>
            <p className="mt-1 text-[13px] text-ink-3">Check your connection and try again.</p>
            {onRetry && <Button variant="outline" onClick={onRetry} className="mt-4">Try again</Button>}
          </div>
        )}
        {empty && (
          <div className="px-4 py-12 text-center">
            <span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-card bg-crema text-roast">
              <Search className="size-5" strokeWidth={1.9} />
            </span>
            <p className="mt-3 text-sm font-semibold">{searching ? `Nothing matches “${params.q || 'these filters'}”` : emptyState.title}</p>
            <p className="mt-1 text-[13px] text-ink-3">{searching ? 'Try another search or clear the filters.' : emptyState.text}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-soft px-3.5 py-3">
        <span aria-live="polite" className="text-[12.5px] text-ink-2">
          {total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : loading ? 'Loading…' : 'No results'}
        </span>
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => set({ page: page - 1 })} className="grid size-9 cursor-pointer place-items-center rounded-control border border-sand bg-white text-ink disabled:cursor-default disabled:text-sand-strong">
            <ChevronLeft aria-hidden="true" className="size-[15px]" strokeWidth={2.2} />
          </button>
          {pageList(Math.min(page, pages), pages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-[13px] text-ink-3">…</span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === page ? 'page' : undefined}
                onClick={() => set({ page: n })}
                className={cn('h-9 min-w-9 cursor-pointer rounded-control border px-2 text-[13px] font-semibold', n === page ? 'border-roast bg-roast text-white' : 'border-sand bg-white text-ink')}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => set({ page: page + 1 })} className="grid size-9 cursor-pointer place-items-center rounded-control border border-sand bg-white text-ink disabled:cursor-default disabled:text-sand-strong">
            <ChevronRight aria-hidden="true" className="size-[15px]" strokeWidth={2.2} />
          </button>
        </nav>
      </div>
    </section>
  )
}
