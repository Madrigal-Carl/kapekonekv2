// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTableParams } from './useTableParams'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function harness(url, defaults = { status: 'active' }) {
  const out = {}
  function Probe() {
    Object.assign(out, useTableParams(defaults))
    out.search = useLocation().search
    return null
  }
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>,
  )
  return out
}

describe('useTableParams', () => {
  it('reads defaults and the URL, with page as a number', () => {
    const t = harness('/x?status=archived&page=3&municipality=Boac')
    expect(t.params).toEqual({ q: '', page: 3, status: 'archived', municipality: 'Boac' })
    expect(harness('/y').params).toEqual({ q: '', page: 1, status: 'active' })
  })

  it('writes filters to the URL and goes back to page 1; the default value leaves the URL', () => {
    const t = harness('/x?page=4')
    act(() => t.set({ status: 'archived' }))
    expect(t.search).toBe('?status=archived')
    act(() => t.set({ page: 2 }))
    expect(t.search).toBe('?status=archived&page=2')
    act(() => t.set({ status: 'active' }))
    expect(t.search).toBe('')
  })

  it('a search typed right after closing a drawer doesn’t reopen it', () => {
    vi.useFakeTimers()
    const t = harness('/x?open=new')
    const typed = t.set // the search box's handler, from before the drawer closed
    act(() => t.set({ open: null }))
    act(() => typed({ q: 'Pantayin' }))
    act(() => vi.advanceTimersByTime(300))
    expect(t.search).toBe('?q=Pantayin')
  })

  it('keeps an "All" choice when the default is narrower', () => {
    const t = harness('/x')
    act(() => t.set({ status: '' }))
    expect(t.search).toBe('?status=')
    expect(t.params.status).toBe('')
  })

  it('debounces the search by 300 ms', () => {
    vi.useFakeTimers()
    const t = harness('/x?page=2')
    act(() => t.set({ q: 'ro' }))
    act(() => t.set({ q: 'rodel' }))
    expect(t.search).toBe('?page=2')
    act(() => vi.advanceTimersByTime(300))
    expect(t.search).toBe('?q=rodel')
  })

  it('clear resets every filter but the search', () => {
    const t = harness('/x?q=liza&status=archived&municipality=Boac&page=2')
    act(() => t.clear())
    expect(t.search).toBe('?q=liza')
    expect(t.params).toMatchObject({ q: 'liza', status: 'active', page: 1 })
  })
})
