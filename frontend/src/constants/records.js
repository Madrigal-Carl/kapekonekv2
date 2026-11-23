import { VARIETIES } from './charts'
// Shared by the record pages (Farmers, Group Managers, Associations) and their drawers.

/** Farmer status → [pill label, tone]. "Approved", never "verified" (CLAUDE.md). */
export const FARMER_STATUS = { approved: ['Approved', 'green'], pending: ['Waiting', 'amber'], rejected: ['Rejected', 'red'] }

const AVATARS = ['bg-avatar-green', 'bg-caramel-ink', 'bg-roast', 'bg-ink-2']
/** A stable avatar color per record id. */
export const avatarFor = (id = '') => AVATARS[[...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length]

/** A stored document → the DocumentUpload value shape. */
export const uploadValue = (doc) =>
  doc ? { url: doc.url, publicId: doc.publicId, name: doc.name ?? 'Document', bytes: doc.bytes, ext: doc.kind === 'pdf' ? 'PDF' : (doc.name?.split('.').pop() ?? 'IMG').toUpperCase() } : null

/** Tree stage → pill tone (Trees.dc.html). Bar and legend colors are TREE_STAGES in charts.js. */
export const STAGE_TONE = { newly_planted: 'blue', growing: 'amber', flowering: 'green', fruiting: 'roast', damaged: 'red' }

export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']

/** "Rodel Mendoza" → "RM". */
export const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Who a farm, tree group or harvest belongs to, as a DataTable person cell. */
export const ownerCell = (owner, farm) =>
  farm.ownerType === 'kaluppa'
    ? { name: 'Kaluppa farm', sub: farm.managedBy ? `Managed by ${farm.managedBy.name}` : 'No Group Manager yet', initials: 'KP', avatarClassName: 'bg-espresso' }
    : { name: owner.name, sub: farm.association?.name ?? farm.barangay, initials: initialsOf(owner.name), avatarClassName: avatarFor(owner.id) }

// Tree group and harvest tables (Trees.dc.html, Harvests.dc.html).
export const RECORD_STATUS = {
  label: 'Status',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
}
export const VARIETY_FILTER = { key: 'variety', label: 'Variety', options: [{ value: '', label: 'All varieties' }, ...VARIETIES.map((v) => ({ value: v.key, label: v.label }))] }
/** Farm filter options: every active farm in scope. */
export const farmFilter = (farms) => ({
  key: 'farmId',
  label: 'Farm',
  options: [{ value: '', label: 'All farms' }, ...(farms ?? []).map((f) => ({ value: f.id, label: f.propertyNumber }))],
})

/** Row actions for a tree group or harvest: change it when its farm allows, else open the farm. */
export const recordActions = (record) => (record.status === 'archived' ? (record.canEdit ? ['restore'] : ['view']) : record.canEdit ? ['edit', 'archive'] : ['view'])

