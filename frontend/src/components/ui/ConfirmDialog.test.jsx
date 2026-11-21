// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

const setup = (props = {}) => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(
    <>
      <button type="button">Outside</button>
      <ConfirmDialog open title="Log out of KapeKonek?" cancelLabel="Stay signed in" confirmLabel="Log out" onClose={onClose} onConfirm={onConfirm} {...props} />
    </>,
  )
  return { onClose, onConfirm }
}

describe('ConfirmDialog', () => {
  it('is a labelled modal dialog with focus on the cancel button', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Log out of KapeKonek?' })).toHaveProperty('ariaModal', 'true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay signed in' }))
  })

  it('traps Tab focus inside the dialog', () => {
    setup()
    const cancel = screen.getByRole('button', { name: 'Stay signed in' })
    const confirm = screen.getByRole('button', { name: 'Log out' })
    confirm.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('closes on Esc and confirms on click', () => {
    const { onClose, onConfirm } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
