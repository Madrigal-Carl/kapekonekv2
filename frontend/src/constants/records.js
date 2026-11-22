// Shared by the record pages (Farmers, Group Managers, Associations) and their drawers.

/** Farmer status → [pill label, tone]. "Approved", never "verified" (CLAUDE.md). */
export const FARMER_STATUS = { approved: ['Approved', 'green'], pending: ['Waiting', 'amber'], rejected: ['Rejected', 'red'] }

const AVATARS = ['bg-avatar-green', 'bg-caramel-ink', 'bg-roast', 'bg-ink-2']
/** A stable avatar color per record id. */
export const avatarFor = (id = '') => AVATARS[[...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length]

/** A stored document → the DocumentUpload value shape. */
export const uploadValue = (doc) =>
  doc ? { url: doc.url, publicId: doc.publicId, name: doc.name ?? 'Document', bytes: doc.bytes, ext: doc.kind === 'pdf' ? 'PDF' : (doc.name?.split('.').pop() ?? 'IMG').toUpperCase() } : null
