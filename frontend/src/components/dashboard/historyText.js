// What a History entry says (DESIGN §8.2 History): "<Name> <what>", and each changed field as `field` before → after.
import { formatPesoShort } from '@/lib/format'

/** One phrase per area and action. */
const ACTIONS = {
  farms: { create: 'added the farm', update: 'edited the farm', archive: 'archived the farm', restore: 'restored the farm', assign_farmers: 'assigned farmers' },
  trees: { create: 'added the tree group', update: 'edited the tree group', archive: 'archived the tree group', restore: 'restored the tree group' },
  harvests: { create: 'recorded the harvest', update: 'edited the harvest', archive: 'archived the harvest', restore: 'restored the harvest' },
  beans: {
    create: 'listed the beans',
    update: 'edited the listing',
    approve: 'approved the listing',
    reject: 'rejected the listing',
    complete: 'completed the sale at the branch',
    cancel: 'cancelled the listing',
    expire: 'expired the listing after 7 days',
  },
  orders: {
    place: 'placed the order',
    receipt_check: 'checked the receipt',
    reserved: 'confirmed the order and reserved stock',
    processing: 'started preparing the order',
    out_for_delivery: 'sent it out for delivery',
    ready_for_pickup: 'marked it ready for pickup',
    sold: 'marked it sold',
    cancelled: 'cancelled the order',
    rejected: 'rejected the order',
    expired: 'expired the order',
    refund: 'recorded the refund',
  },
  inventory: { create: 'added the product', update: 'edited the product', archive: 'archived the product', restore: 'restored the product' },
  reviews: { reply: 'replied', update_reply: 'edited the reply', delete_reply: 'deleted the reply', hide: 'hid the review', unhide: 'showed the review again' },
  farmers: {
    create: 'created the account',
    update: 'edited the profile',
    contact: 'changed the contact number',
    request: 'sent a request to join',
    request_withdraw: 'withdrew the request',
    documents: 'replaced documents',
    approve: 'approved the farmer',
    reject: 'rejected the request',
    transfer_request: 'asked to transfer',
    transfer_withdraw: 'withdrew the transfer',
    transfer_approve: 'approved the transfer',
    transfer_reject: 'declined the transfer',
    remove: 'removed the farmer from the association',
  },
  group_managers: { create: 'created the account', update: 'edited the account', archive: 'archived the account', restore: 'restored the account' },
  associations: { create: 'created the association and its group chat', update: 'edited the association', archive: 'archived the association', restore: 'restored the association' },
}

/** An edit that changed one field says what it was ("changed the stage"). */
const ONE_FIELD = {
  stage: 'changed the stage',
  count: 'corrected the count',
  yieldKg: 'corrected the yield',
  priceCentavos: 'changed the price',
  stock: 'changed the stock',
  thumbnail: 'set a new thumbnail',
  description: 'edited the description',
  contactNumber: 'changed the contact number',
  location: 'moved the pin',
  association: 'assigned the association',
  groupManager: 'assigned the Group Manager',
}

const FIELDS = {
  sizeHa: 'size (ha)',
  yieldKg: 'yield (kg)',
  weightKg: 'weight (kg)',
  priceCentavos: 'price',
  pricePerKgCentavos: 'price per kg',
  contactNumber: 'contact number',
  managedBy: 'managed by',
  groupManager: 'Group Manager',
  lotNumber: 'lot',
  plantedAt: 'planted',
  harvestedAt: 'harvested',
  isFeatured: 'featured',
  isActive: 'active',
  coffeeType: 'coffee type',
  hiddenReason: 'hidden reason',
  rejectionReason: 'reason',
  assignedFarmers: 'assigned farmers',
  receiptCheck: 'receipt',
  refundReference: 'refund reference',
  archivedAt: 'archived',
}

/** "Rodel Mendoza" + "<what>". */
export function historyPhrase({ area, action, changes }) {
  if (action === 'update' && changes.length === 1 && ONE_FIELD[changes[0].field]) return ONE_FIELD[changes[0].field]
  return ACTIONS[area]?.[action] ?? action.replaceAll('_', ' ')
}

export const fieldLabel = (field) => FIELDS[field] ?? field

/** A before/after value as text: pesos for centavos, counts for lists, — for nothing. */
export function fieldValue(field, value) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length && typeof value[0] === 'string' && value.every((v) => v.length < 30) ? value.join(', ') : `${value.length}`
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (/Centavos$/.test(field) && typeof value === 'number') return formatPesoShort(value)
  if (field === 'archivedAt') return 'yes'
  const text = String(value).replaceAll('_', ' ')
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}
