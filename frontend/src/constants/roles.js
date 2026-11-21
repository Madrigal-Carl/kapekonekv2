export const ROLE_LABELS = {
  kaluppa: 'Kaluppa',
  group_manager: 'Group Manager',
  farmer: 'Farmer',
  buyer: 'Buyer',
}

export const DASHBOARD_ROLES = ['kaluppa', 'group_manager', 'farmer']

/** Where a role lands after sign-in. */
export const homeFor = (roles = []) => (roles.includes('buyer') ? '/' : '/dashboard/overview')

/** The role shown in the UI (a user has one in Phase 1). */
export const primaryRole = (roles = []) => DASHBOARD_ROLES.find((r) => roles.includes(r)) ?? roles[0]
