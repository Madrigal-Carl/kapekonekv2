// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { checkFile } from '@/lib/fileCheck'
import { FileDrop } from './FileDrop'

const MB = 1024 * 1024
const fileOf = (name, bytes, type) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

describe('FileDrop', () => {
  it('checks type and size before uploading', () => {
    expect(checkFile('image', fileOf('a.png', 5 * MB, 'image/png'))).toBeNull()
    expect(checkFile('image', fileOf('receipt.png', Math.round(7.2 * MB), 'image/png'), 'Try a screenshot instead.')).toEqual({
      title: 'receipt.png is 7.2 MB.',
      detail: 'Images can be up to 5 MB. Try a screenshot instead.',
    })
    expect(checkFile('image', fileOf('menu.pdf', 1000, 'application/pdf')).title).toBe('menu.pdf isn’t a supported type.')
    expect(checkFile('file', fileOf('clip.mp4', 10 * MB, 'video/mp4'))).toBeNull()
  })

  it('stops a file that is too large and shows the reason in the drop zone', () => {
    const onFile = vi.fn()
    let problem = null
    const { container, rerender } = render(<FileDrop kind="image" title="Upload your receipt" onFile={onFile} onError={(p) => (problem = p)} />)
    fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [fileOf('receipt.png', 6 * MB, 'image/png')] } })
    expect(onFile).not.toHaveBeenCalled()
    rerender(<FileDrop kind="image" title="Upload your receipt" onFile={onFile} error={problem} />)
    expect(screen.getByRole('alert').textContent).toBe('receipt.png is 6.0 MB.Images can be up to 5 MB.')

    fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [fileOf('ok.jpg', MB, 'image/jpeg')] } })
    expect(onFile).toHaveBeenCalledTimes(1)
  })
})
