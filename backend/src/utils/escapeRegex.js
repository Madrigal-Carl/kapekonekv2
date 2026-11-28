/** Escape user text for use inside a RegExp. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" pattern for search boxes. */
export const containsPattern = (s) => new RegExp(escapeRegex(s), 'i');
