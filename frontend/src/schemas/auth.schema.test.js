import { describe, expect, it } from 'vitest'
import { firstPasswordSchema, registerSchema } from './auth.schema.js'

const base = {
  role: 'buyer', firstName: 'Ana', middleName: '', lastName: 'Cruz', username: 'anacruz',
  email: 'ana@example.com', password: 'KapeKonek@123', confirmPassword: 'KapeKonek@123', contactNumber: '',
}
const errorPaths = (result) => result.error?.issues.map((i) => i.path.join('.')) ?? []

describe('registerSchema', () => {
  it('lets a buyer leave the contact number empty', () => {
    expect(registerSchema.safeParse(base).success).toBe(true)
  })

  it('needs a valid contact number from a farmer', () => {
    expect(errorPaths(registerSchema.safeParse({ ...base, role: 'farmer' }))).toEqual(['contactNumber'])
    expect(errorPaths(registerSchema.safeParse({ ...base, role: 'farmer', contactNumber: '12345' }))).toEqual(['contactNumber'])
    expect(registerSchema.parse({ ...base, role: 'farmer', contactNumber: '0917 555 0199' }).contactNumber).toBe('09175550199')
  })
})

describe('firstPasswordSchema', () => {
  it('uses the password rule and must match', () => {
    expect(firstPasswordSchema.safeParse({ newPassword: 'short', confirmPassword: 'short' }).success).toBe(false)
    expect(errorPaths(firstPasswordSchema.safeParse({ newPassword: 'Fresh@Pass1', confirmPassword: 'Fresh@Pass2' }))).toEqual(['confirmPassword'])
    expect(firstPasswordSchema.safeParse({ newPassword: 'Fresh@Pass1', confirmPassword: 'Fresh@Pass1' }).success).toBe(true)
  })
})
