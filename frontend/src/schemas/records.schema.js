import { z } from 'zod'
import { associationDescriptionRule, associationNameRule, emailRule, farmSizeRule, farmStreetRule, nameRule, optionalNameRule, pastDateRule, phoneRule, recordNoteRule, treeCountRule, usernameRule, yieldRule } from './rules.js'

// Mirror backend/src/schemas/{farmer,groupManager,association}.schema.js. Documents and pickers are sent beside these.

/** A Group Manager adds or edits a farmer. Email is required (Change 08): they verify it before the dashboard opens. */
export const farmerFormSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  contactNumber: phoneRule,
  email: emailRule,
})

export const groupManagerFormSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  contactNumber: phoneRule,
  email: emailRule,
  associationId: z.string().nullable(),
})

export const associationFormSchema = z.object({
  name: associationNameRule,
  municipality: z.string().min(1, 'Choose a municipality in Marinduque'),
  description: associationDescriptionRule,
  groupManagerId: z.string().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(), // meeting point; null = town centre (Change 08)
})

/**
 * Add/edit a farm (mirrors backend farm.schema.js). A Group Manager's form names the farmer first (`needsFarmer`);
 * Kaluppa's sets `managedById` (null = "Assign later"). The barangay list itself comes from `/locations`.
 */
export const farmFormSchema = ({ needsFarmer = false } = {}) =>
  z.object({
    farmerId: needsFarmer ? z.string('Choose the farmer who owns this farm').min(1, 'Choose the farmer who owns this farm') : z.string().optional(),
    managedById: z.string().nullable().optional(),
    sizeHa: farmSizeRule,
    municipality: z.string('Choose a municipality in Marinduque').min(1, 'Choose a municipality in Marinduque'),
    barangay: z.string('Choose a barangay').min(1, 'Choose a barangay'),
    street: farmStreetRule,
    location: z.object({ lat: z.number(), lng: z.number() }, 'Drop the farm pin on the map'),
  })

const pick = (message) => z.string(message).min(1, message)

/** Add/edit a tree group (mirrors backend record.schema.js). */
export const treeGroupFormSchema = z.object({
  farmId: pick('Choose a farm'),
  variety: pick('Choose a variety'),
  stage: pick('Choose a stage'),
  count: treeCountRule,
  plantedAt: pastDateRule,
  note: recordNoteRule,
})

/** Record/edit a harvest. The API checks that the farm has trees of the variety. */
export const harvestFormSchema = z.object({
  farmId: pick('Choose a farm'),
  variety: pick('Choose a variety'),
  yieldKg: yieldRule,
  harvestedAt: pastDateRule,
  note: recordNoteRule,
})
