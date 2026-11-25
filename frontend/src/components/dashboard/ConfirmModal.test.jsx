// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from './ConfirmModal'

afterEach(cleanup)

describe('ConfirmModal', () => {
  it('archive: confirms without a reason, focus starts on the safe button', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal open variant="archive" title="Archive this farm?" confirmLabel="Archive farm" cancelLabel="Keep it" onClose={() => {}} onConfirm={onConfirm}>Its tree groups move to Archived.</ConfirmModal>)
    expect(screen.getByRole('dialog', { name: 'Archive this farm?' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive farm' }))
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('a reason-required modal keeps confirm disabled below 5 characters, then sends the trimmed reason', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal open variant="reject" title="Reject Joy’s request?" confirmLabel="Reject request" reasonPlaceholder="e.g. The proof is blurry" onClose={() => {}} onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Reject request' })
    const reason = screen.getByRole('textbox', { name: /Reason/ })
    fireEvent.change(reason, { target: { value: ' blur ' } })
    expect(confirm.disabled).toBe(true)
    fireEvent.change(reason, { target: { value: '  Too blurry  ' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('Too blurry')
  })

  it('with reason options: confirm waits for a pick; "Other" also needs a written reason', () => {
    const onConfirm = vi.fn()
    const options = [{ value: 'change_items', label: 'Change items' }, { value: 'other', label: 'Other' }]
    render(<ConfirmModal open variant="cancel_sale" title="Cancel this order?" confirmLabel="Cancel order" reasonOptions={options} onClose={() => {}} onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Cancel order' })
    expect(confirm.disabled).toBe(true)
    expect(screen.queryByRole('textbox', { name: /Tell us more/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Reason/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Change items' }))
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenLastCalledWith(undefined, 'change_items')
    fireEvent.click(screen.getByRole('button', { name: /Reason/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Other' }))
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: /Tell us more/ }), { target: { value: 'Found it cheaper nearby' } })
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenLastCalledWith('Found it cheaper nearby', 'other')
  })

  it('temporary password: Copy writes it to the clipboard; Done closes', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onClose = vi.fn()
    render(<ConfirmModal open variant="temporary_password" title="Account created" password="kape-7Q4m-ub9X" onClose={onClose}>Give Ernesto this temporary password.</ConfirmModal>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(writeText).toHaveBeenCalledWith('kape-7Q4m-ub9X')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('without onConfirm it only explains, with one close button', () => {
    render(<ConfirmModal open variant="archive" title="Archive Boac Growers?" cancelLabel="Close" confirmLabel="Archive" onClose={() => {}}>You can’t archive it yet.</ConfirmModal>)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Close'])
  })
})
