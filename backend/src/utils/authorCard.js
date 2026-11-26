import { ROLE_LABELS, ROLES } from '../constants/permissions.js';

/**
 * How a post or comment author is shown: Kaluppa by name, people as "Rodel M." with a role badge.
 * `full`: the whole name ("Rodel Mendoza"), for the signed-in Hub.
 */
export function authorCard(user, { full = false } = {}) {
  if (!user) return { _id: null, name: 'KapeKonek member', initials: 'KK', role: null, roleLabel: null, avatarUrl: null };
  const role = user.roles?.[0] ?? null;
  const isKaluppa = role === ROLES.KALUPPA;
  const last = user.lastName?.trim() ?? '';
  return {
    _id: user._id,
    name: isKaluppa ? 'Kaluppa' : full ? `${user.firstName} ${last}`.trim() : `${user.firstName} ${last[0] ?? ''}.`.replace(' .', ''),
    initials: isKaluppa ? 'KP' : `${user.firstName[0] ?? ''}${last[0] ?? ''}`.toUpperCase(),
    role,
    roleLabel: ROLE_LABELS[role] ?? null,
    avatarUrl: user.avatar?.url ?? null,
  };
}
