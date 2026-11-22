// Chart colors (DESIGN §8.3, validated with the dataviz checker; don't change the order).

export const VARIETIES = [
  { key: 'liberica', label: 'Liberica', color: 'var(--color-chart-1)' },
  { key: 'excelsa', label: 'Excelsa', color: 'var(--color-chart-2)' },
  { key: 'robusta', label: 'Robusta', color: 'var(--color-chart-3)' },
  { key: 'arabica', label: 'Arabica', color: 'var(--color-chart-4)' },
]

export const TREE_STAGES = [
  { key: 'newly_planted', label: 'Newly planted', color: 'var(--color-chart-1)' },
  { key: 'growing', label: 'Growing', color: 'var(--color-chart-2)' },
  { key: 'flowering', label: 'Flowering', color: 'var(--color-chart-3)' },
  { key: 'fruiting', label: 'Fruiting', color: 'var(--color-chart-4)' },
  { key: 'damaged', label: 'Damaged', color: 'var(--color-chart-5)' },
]

/** Single-series charts use Roast. */
export const SINGLE_SERIES = 'var(--color-roast)'

/** Stage counts from the API (`[{ stage, count }]`) in legend order, zeros included. */
export const stageItems = (rows = []) => TREE_STAGES.map((s) => ({ ...s, count: rows.find((r) => r.stage === s.key)?.count ?? 0 }))
