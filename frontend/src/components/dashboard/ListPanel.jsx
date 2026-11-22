import { Link } from 'react-router-dom'
import { StatusPill } from './StatusPill'

/**
 * Overview list card: a header with a link, then rows of title / sub / status pill, or an empty line.
 * @param {{ title: string, link: { to: string, label: string }, rows: Array<{ key: string, title: string, sub: string, status?: string, tone?: string, lead?: React.ReactNode, action?: React.ReactNode }>, empty: string }} props
 */
export function ListPanel({ title, link, rows, empty }) {
  return (
    <section className="rounded-card border border-sand bg-white">
      <div className="flex items-center justify-between border-b border-sand-soft px-[18px] py-4">
        <h2 className="text-[15.5px] font-semibold">{title}</h2>
        <Link to={link.to} className="text-[13px] font-semibold no-underline">{link.label}</Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-[18px] py-6 text-center text-[13px] text-ink-3">{empty}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 border-b border-skeleton px-[18px] py-3 last:border-b-0">
              {r.lead}
              <div className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{r.title}</span>
                <span className="block text-xs text-ink-3">{r.sub}</span>
              </div>
              {r.status && <StatusPill tone={r.tone}>{r.status}</StatusPill>}
              {r.action}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
