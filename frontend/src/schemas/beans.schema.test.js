import { describe, expect, it } from 'vitest'
import { beanCompleteFormSchema, beanFormSchema } from './beans.schema.js'

const photo = { url: 'https://res.cloudinary.com/x/image/upload/a.jpg', publicId: 'kapekonek/bean-photos/me/a' }
const good = { variety: 'liberica', form: 'dried_cherry', weightKg: 2, price: 180.5, photos: [photo], note: '' }

describe('beanFormSchema', () => {
  it('turns the peso price into centavos', () => {
    expect(beanFormSchema().parse(good).price).toBe(18_050)
  })
  it('needs a farmer only for a Group Manager’s new listing', () => {
    expect(beanFormSchema().safeParse(good).success).toBe(true)
    const res = beanFormSchema({ needsFarmer: true }).safeParse(good)
    expect(res.error.issues[0]).toMatchObject({ path: ['farmerId'], message: 'Choose the farmer' })
  })
  it('uses the shared weight, price and photo rules', () => {
    const res = beanFormSchema().safeParse({ ...good, weightKg: 1.2, price: 0.5, photos: [] })
    expect(Object.fromEntries(res.error.issues.map((i) => [i.path[0], i.message]))).toEqual({
      weightKg: 'Use steps of 0.5 kg', price: 'Enter at least ₱1 per kg', photos: 'Add at least 1 photo',
    })
  })
})

describe('beanCompleteFormSchema', () => {
  it('keeps two decimals of weight and turns the amount into centavos', () => {
    expect(beanCompleteFormSchema.parse({ finalWeightKg: 2.8, finalAmount: 896 })).toEqual({ finalWeightKg: 2.8, finalAmount: 89_600 })
    expect(beanCompleteFormSchema.safeParse({ finalWeightKg: 0, finalAmount: 0.5 }).success).toBe(false)
  })
})
