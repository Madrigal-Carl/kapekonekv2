// Overview date filter (PHASE-2-SPEC §3.14, DESIGN §8.2).
export const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
]

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-PH')} ${n === 1 ? one : many}`

/**
 * KPI note for a period figure (Overview*.dc.html): how many for today and this week, the comparison with the
 * previous period for this month and this year ("▲ 12% vs October").
 * @param {{ key: string, prevLabel: string }} period
 * @param {{ count: number, pct: number|null }} figure
 * @param {string} noun e.g. 'harvest' @param {string} verb e.g. 'recorded'
 */
export function periodNote(period, figure, noun, verb) {
  const today = period.key === 'today'
  if (today || period.key === 'week') {
    if (!figure.count) return { text: today ? `Nothing ${verb} yet today` : `Nothing ${verb} this week`, tone: 'muted' }
    return { text: `${plural(figure.count, noun)} ${verb}${today ? ' today' : ''}`, tone: 'good' }
  }
  if (figure.pct == null) return { text: `Nothing to compare with ${period.prevLabel}`, tone: 'muted' }
  return { text: `${figure.pct >= 0 ? '▲' : '▼'} ${Math.abs(figure.pct)}% vs ${period.prevLabel}`, tone: figure.pct >= 0 ? 'good' : 'muted' }
}

/** A chart title per period: [today, this week, this month, this year]. */
export const periodTitle = (period, titles) => titles[PERIODS.findIndex((p) => p.key === period.key)]
