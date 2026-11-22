import { describe, expect, it } from 'vitest'
import { changePasswordSchema, profileSchema } from './account.schema'

const base = { firstName: 'Juana', middleName: '', lastName: 'Dela Cruz', username: 'juanadc' }

describe('profileSchema', () => {
  it.each([
    ['', null],
    ['   ', null],
    [null, null],
    ['0917 123 4567', '09171234567'],
  ])('contact number %j → %j', (input, expected) => {
    expect(profileSchema.parse({ ...base, contactNumber: input }).contactNumber).toBe(expected)
  })

  it('refuses a malformed number and a blank middle name becomes null', () => {
    expect(profileSchema.safeParse({ ...base, contactNumber: '12345' }).success).toBe(false)
    expect(profileSchema.parse({ ...base, contactNumber: '' }).middleName).toBeNull()
  })
})

describe('changePasswordSchema', () => {
  it('needs matching passwords that pass the rule', () => {
    const ok = { currentPassword: 'old', password: 'NewPass456!', confirmPassword: 'NewPass456!' }
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
    const issue = changePasswordSchema.safeParse({ ...ok, confirmPassword: 'Other' }).error.issues[0]
    expect(issue.path).toEqual(['confirmPassword'])
  })
})
