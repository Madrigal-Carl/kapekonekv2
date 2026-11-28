import { z } from 'zod'
import { beanAmountRule, beanFinalWeightRule, beanPhotosRule, beanPriceRule, beanWeightRule, recordNoteRule } from './rules.js'

// Mirror backend/src/schemas/bean.schema.js. People type pesos; the API takes integer centavos.
const pick = (message) => z.string(message).min(1, message)
const pesos = (rule, message) => z.number(message).transform((p) => Math.round(p * 100)).pipe(rule)

/** List or edit beans. A Group Manager's new listing names the farmer first. Submits `price` as centavos. */
export const beanFormSchema = ({ needsFarmer = false } = {}) =>
  z.object({
    farmerId: needsFarmer ? pick('Choose the farmer') : z.string().optional(),
    variety: pick('Choose a variety'),
    form: pick('Choose a form'),
    weightKg: beanWeightRule,
    price: pesos(beanPriceRule, 'Enter your price per kg'),
    photos: beanPhotosRule,
    note: recordNoteRule,
  })

/** What Kaluppa weighed and paid at the branch. Submits `finalAmount` as centavos. */
export const beanCompleteFormSchema = z.object({
  finalWeightKg: beanFinalWeightRule,
  finalAmount: pesos(beanAmountRule, 'Enter the amount paid'),
})
