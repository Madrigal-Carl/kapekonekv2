// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuantityStepper } from './QuantityStepper'

afterEach(cleanup)

describe('QuantityStepper', () => {
  it('disables + at the cap and shows the cap hint', () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuantityStepper value={1} onChange={onChange} unit="pack" max={2} hint="Whole packs only" capHint="That is the most you can add." />)
    expect(screen.getByText('Whole packs only')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(onChange).toHaveBeenCalledWith(2)
    rerender(<QuantityStepper value={2} onChange={onChange} unit="pack" max={2} hint="Whole packs only" capHint="That is the most you can add." />)
    expect(screen.getByRole('button', { name: 'Increase quantity' }).disabled).toBe(true)
    expect(screen.getByText('That is the most you can add.')).toBeTruthy()
  })

  it('steps kg in halves up to the cap', () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2.5} onChange={onChange} unit="kg" max={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})
