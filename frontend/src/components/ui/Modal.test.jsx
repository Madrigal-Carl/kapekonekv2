// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Modal } from './Modal'

afterEach(cleanup)

const Two = ({ drawer, confirm }) => (
  <>
    <Modal open={drawer} onClose={() => {}} labelledBy="a"><button type="button">Drawer</button></Modal>
    <Modal open={confirm} onClose={() => {}} labelledBy="b"><button type="button">Confirm</button></Modal>
  </>
)

describe('Modal page scroll lock', () => {
  it('unlocks the page when a dialog and the one stacked on it close together (cart → Checkout)', () => {
    const { rerender } = render(<Two drawer confirm={false} />)
    rerender(<Two drawer confirm />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Two drawer={false} confirm={false} />)
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the page locked while the dialog underneath is still open', () => {
    const { rerender } = render(<Two drawer confirm />)
    rerender(<Two drawer confirm={false} />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Two drawer={false} confirm={false} />)
    expect(document.body.style.overflow).toBe('')
  })
})
