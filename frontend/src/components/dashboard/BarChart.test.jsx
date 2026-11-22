// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'

afterEach(cleanup)

const labels = ['Jan', 'Feb', 'Mar']
const one = [{ name: 'Harvest', color: 'var(--color-roast)', values: [120, 0, 60] }]
const two = [...one, { name: 'Excelsa', color: 'var(--color-chart-2)', values: [10, 20, 30] }]

describe('BarChart', () => {
  it('shows a legend only for two or more series', () => {
    render(<BarChart labels={labels} series={one} suffix=" kg" aria="Harvest per month" />)
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull()
    cleanup()
    render(<BarChart labels={labels} series={two} suffix=" kg" aria="Harvest per month" />)
    expect(within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('"View as table" swaps the chart for a real table and back', () => {
    render(<BarChart labels={labels} series={one} suffix=" kg" aria="Harvest per month" />)
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
    const table = screen.getByRole('table')
    expect(within(table).getByRole('rowheader', { name: 'Jan' })).toBeTruthy()
    expect(within(table).getByText('120 kg')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Harvest per month' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show chart' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the tooltip when a month column gets keyboard focus', () => {
    render(<BarChart labels={labels} series={two} suffix=" kg" aria="Harvest per month" />)
    fireEvent.focus(screen.getByRole('button', { name: /^Feb/ }))
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('Feb')
    expect(tip.textContent).toContain('20 kg')
  })

  it('says so when there is no data yet', () => {
    render(<BarChart labels={labels} series={[{ name: 'Harvest', color: 'x', values: [0, 0, 0] }]} aria="Harvest per month" empty="No harvests recorded yet" />)
    expect(screen.getByText('No harvests recorded yet')).toBeTruthy()
  })
})
