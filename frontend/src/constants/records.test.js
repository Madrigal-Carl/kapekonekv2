import { describe, expect, it } from 'vitest'
import { initialsOf } from './records'

describe('initialsOf', () => {
  it.each([
    ['Nestor Perez', 'NP'],
    ['Rodel Mendoza', 'RM'],
    ['Ana  Villanueva', 'AV'],
    ['Liza', 'L'],
    ['', ''],
  ])('%s → %s', (name, expected) => expect(initialsOf(name)).toBe(expected))
})
