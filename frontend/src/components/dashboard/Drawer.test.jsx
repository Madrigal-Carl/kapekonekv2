// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'

afterEach(cleanup)

describe('Drawer', () => {
  it('is a labelled dialog that traps focus and closes on Esc', () => {
    const onClose = vi.fn()
    render(
      <Drawer open eyebrow="Association" title="Add association" onClose={onClose} footer={<button type="button">Save association</button>}>
        <input aria-label="Name" />
      </Drawer>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Add association' })
    expect(dialog).toBeTruthy()
    expect(screen.getByText('Association')).toBeTruthy()
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save association' })
    save.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders nothing when closed', () => {
    render(<Drawer open={false} title="Add association" onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
