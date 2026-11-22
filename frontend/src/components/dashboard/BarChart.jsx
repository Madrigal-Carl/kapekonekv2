import { useId, useState } from 'react'

const W = 640
const X0 = 50
const PLOT_W = 586

/** "M x y" path for a bar with 4px rounded top corners, anchored at the baseline. */
function roundTop(x, y, w, h, r) {
  if (h <= 0) return ''
  r = Math.min(r, w / 2, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}
const square = (x, y, w, h) => (h <= 0 ? '' : `M${x} ${y}h${w}v${h}h${-w}Z`)

/** A step of 1 / 2 / 2.5 / 5 × 10ⁿ so the axis has at most four lines. */
function niceMax(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => raw / s <= 4) ?? mag * 10
  return Math.ceil(raw / step) * step
}

/**
 * Stacked bar chart (BarChart.dc.html): one y-axis, a legend for 2+ series, a hover/focus tooltip and a "View as table" toggle.
 * @param {{ labels: string[], series: Array<{ name: string, color: string, values: number[] }>, prefix?: string, suffix?: string, height?: number, aria: string, xName?: string, empty?: string }} props
 */
export function BarChart({ labels, series, prefix = '', suffix = '', height = 220, aria, xName = 'Month', empty = 'No data yet' }) {
  const [hover, setHover] = useState(-1)
  const [asTable, setAsTable] = useState(false)
  const tipId = useId()
  const fmt = (v) => prefix + Number(v).toLocaleString('en-PH', { maximumFractionDigits: 1 }) + suffix
  const totals = labels.map((_, i) => series.reduce((s, se) => s + (se.values[i] || 0), 0))
  const hasData = totals.some((t) => t > 0)

  if (!hasData) {
    return (
      <figure className="m-0 grid place-items-center rounded-control border border-dashed border-sand bg-cream text-center text-[13px] text-ink-3" style={{ minHeight: height }}>
        <figcaption>{empty}</figcaption>
      </figure>
    )
  }

  const base = height - 24
  const top = 10
  const max = niceMax(Math.max(...totals))
  const y = (v) => base - (v / max) * (base - top)
  const slot = PLOT_W / labels.length
  const bw = Math.min(28, slot * 0.56)
  const tipRows = (i) => series.map((s) => ({ name: s.name, color: s.color, value: fmt(s.values[i] || 0) }))
  const columnLabel = (i) => `${labels[i]}: ${tipRows(i).map((r) => `${series.length > 1 ? `${r.name} ` : ''}${r.value}`).join(', ')}`
  const tipLeft = hover >= 0 ? ((X0 + slot * hover + slot / 2) / W) * 100 : 0

  return (
    <figure className="m-0 text-ink">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {series.length > 1 && (
          <ul aria-label="Legend" className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1.5 p-0">
            {series.map((s) => (
              <li key={s.name} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                {s.name}
              </li>
            ))}
          </ul>
        )}
        <span className="flex-1" />
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => {
            setAsTable((t) => !t)
            setHover(-1)
          }}
          className="min-h-[30px] cursor-pointer rounded-control border border-sand bg-white px-2.5 text-xs font-medium text-ink-2"
        >
          {asTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <div className="mt-2 overflow-x-auto rounded-md border border-sand-soft">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-cream">
                <th scope="col" className="px-2.5 py-2 text-left font-semibold text-ink-3">{xName}</th>
                {series.map((s) => (
                  <th key={s.name} scope="col" className="px-2.5 py-2 text-right font-semibold text-ink-3">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => (
                <tr key={label} className="border-t border-skeleton">
                  <th scope="row" className="px-2.5 py-[7px] text-left font-medium">{label}</th>
                  {series.map((s) => (
                    <td key={s.name} className="px-2.5 py-[7px] text-right">{fmt(s.values[i] || 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2" onMouseLeave={() => setHover(-1)}>
          <svg role="img" aria-label={aria} viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full overflow-visible">
            {[1, 2, 3, 4].map((k) => (k * max) / 4).map((v) => (
              <g key={v}>
                <line x1="44" x2="636" y1={y(v)} y2={y(v)} stroke="var(--color-sand-soft)" strokeWidth="1" />
                <text x="38" y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--color-ink-3)">{fmt(v)}</text>
              </g>
            ))}
            <line x1="44" x2="636" y1={base} y2={base} stroke="var(--color-chart-axis)" strokeWidth="1" />
            {labels.map((label, i) => {
              const cx = X0 + slot * i + slot / 2
              const live = series.filter((se) => (se.values[i] || 0) > 0)
              let acc = 0
              return (
                <g key={label}>
                  <rect x={X0 + slot * i} y="0" width={slot} height={base} fill="var(--color-roast)" fillOpacity={i === hover ? 0.06 : 0} />
                  {series.map((se) => {
                    const v = se.values[i] || 0
                    if (!v) return null
                    const y1 = y(acc + v)
                    const y0 = y(acc)
                    const gap = acc > 0 ? 2 : 0
                    acc += v
                    const d = se === live.at(-1) ? roundTop(cx - bw / 2, y1, bw, y0 - y1 - gap, 4) : square(cx - bw / 2, y1, bw, y0 - y1 - gap)
                    return <path key={se.name} d={d} fill={se.color} />
                  })}
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-3)">{label}</text>
                  <rect x={X0 + slot * i} y="0" width={slot} height={height} fill="transparent" className="cursor-crosshair" onMouseEnter={() => setHover(i)} />
                </g>
              )
            })}
          </svg>
          {/* Keyboard: one focusable column per label over the plot; focus shows the same tooltip as hover. */}
          <div className="absolute inset-y-0 flex" style={{ left: `${(X0 / W) * 100}%`, width: `${(PLOT_W / W) * 100}%` }}>
            {labels.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-label={columnLabel(i)}
                aria-describedby={hover === i ? tipId : undefined}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
                className="pointer-events-none flex-1 cursor-default rounded-sm border-0 bg-transparent p-0 opacity-0 focus-visible:opacity-100"
              />
            ))}
          </div>
          {hover >= 0 && (
            <div
              id={tipId}
              role="status"
              className="pointer-events-none absolute top-1 min-w-[150px] rounded-md bg-espresso px-2.5 py-2 text-xs text-white shadow-dropdown"
              style={{ left: `${tipLeft.toFixed(2)}%`, transform: `translateX(${tipLeft > 70 ? '-100%' : tipLeft < 20 ? '0%' : '-50%'})` }}
            >
              <span className="mb-1 block font-semibold">{labels[hover] + (series.length > 1 ? ` · ${fmt(totals[hover])}` : '')}</span>
              {tipRows(hover).map((r) => (
                <span key={r.name} className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-sand">
                    <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: r.color }} />
                    {r.name}
                  </span>
                  <span className="font-semibold">{r.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <figcaption className="sr-only">{aria}</figcaption>
    </figure>
  )
}
