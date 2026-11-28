/**
 * Segmented bar with 2px gaps plus a legend list with counts and percentages (overviews, Reports).
 * @param {{ items: Array<{ key: string, label: string, color: string, count: number }>, empty?: string }} props
 */
export function StageBar({ items, empty = 'No trees recorded yet' }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (!total) return <p className="rounded-control border border-dashed border-sand bg-cream px-4 py-8 text-center text-[13px] text-ink-3">{empty}</p>
  const shown = items.filter((i) => i.count > 0)
  return (
    <div>
      <div role="img" aria-label={shown.map((i) => `${i.label} ${i.count}`).join(', ')} className="flex h-3.5 gap-0.5 overflow-hidden rounded">
        {shown.map((i) => <span key={i.key} style={{ flex: `${i.count} 1 0`, background: i.color }} />)}
      </div>
      <ul className="m-0 mt-3.5 flex list-none flex-col gap-2 p-0">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2.5 text-[13px]">
            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
            <span className="flex-1 text-ink-2">{i.label}</span>
            <span className="font-semibold">{i.count.toLocaleString('en-PH')}</span>
            <span className="w-11 text-right text-xs text-ink-3">{Math.round((i.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
