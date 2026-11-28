import { describe, expect, it } from 'vitest'
import { diffValues, sameValue } from './useDirtyDiff'

describe('diffValues ("Save these changes?")', () => {
  const labels = {
    sizeHa: { label: 'Size', format: (v) => `${Number(v).toFixed(2)} ha` },
    street: 'Street',
    password: { label: 'Password', sensitive: true },
    tags: 'Tags',
  }

  it('lists only changed fields, by their form label, in label order', () => {
    const changes = diffValues({ sizeHa: 1, street: 'Purok 3', tags: ['a'] }, { sizeHa: '1.25', street: 'Purok 3', tags: ['a', 'b'] }, labels)
    expect(changes).toEqual([
      { key: 'sizeHa', label: 'Size', from: '1.00 ha', to: '1.25 ha' },
      { key: 'tags', label: 'Tags', from: 'a', to: 'a, b' },
    ])
  })

  it('treats empty values alike and numbers typed as text as numbers', () => {
    expect(diffValues({ sizeHa: 2, street: null }, { sizeHa: '2', street: '' }, labels)).toEqual([])
    expect(sameValue(undefined, [])).toBe(true)
    expect(sameValue({ lat: 1, lng: 2 }, { lat: 1, lng: 2.5 })).toBe(false)
  })

  it('shows a cleared field as — and never shows a password', () => {
    expect(diffValues({ street: 'Purok 3', password: '' }, { street: '', password: 'Secret@123' }, labels)).toEqual([
      { key: 'street', label: 'Street', from: 'Purok 3', to: '—' },
      { key: 'password', label: 'Password', from: '', to: 'changed', sensitive: true },
    ])
  })
})
