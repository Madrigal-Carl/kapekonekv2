import { ROLE_LABELS, ROLES } from '../constants/permissions.js';

/** How a post or comment author is shown: Kaluppa by name, people as "Rodel M." with a role badge. */
export function authorCard(user) {
  if (!user) return { _id: null, name: 'KapeKonek member', initials: 'KK', role: null, roleLabel: null, avatarUrl: null };
  const role = user.roles?.[0] ?? null;
  const isKaluppa = role === ROLES.KALUPPA;
  const last = user.lastName?.trim() ?? '';
  return {
    _id: user._id,
    name: isKaluppa ? 'Kaluppa' : `${user.firstName} ${last[0] ?? ''}.`.replace(' .', ''),
    initials: isKaluppa ? 'KP' : `${user.firstName[0] ?? ''}${last[0] ?? ''}`.toUpperCase(),
    role,
    roleLabel: ROLE_LABELS[role] ?? null,
    avatarUrl: user.avatar?.url ?? null,
  };
}
