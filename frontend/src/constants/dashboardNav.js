// Dashboard navigation (Sidebar.dc.html). The role picks which nav the user sees (routing);
// each page's route still checks its own permission.

// `icon` is a key of NAV_ICONS in components/ui/icons.js.
const item = (label, icon, to, extra = {}) => ({ label, icon, to, ...extra })
const overview = ['Dashboard', [item('Overview', 'overview', '/dashboard/overview')]]
const records = (...first) => ['Records', [...first, item('Farm', 'farm', '/dashboard/farms'), item('Tree', 'tree', '/dashboard/trees'), item('Harvest', 'harvest', '/dashboard/harvests')]]
// `badge` = key in GET /dashboard/badges; `alert` = roast fill (an action is waiting).
const community = ['Community', [item('Inbox', 'inbox', '/dashboard/inbox', { badge: 'inbox' }), item('Hub', 'hub', '/dashboard/hub')]]
const map = ['Map', [item('Farm Map', 'map', '/dashboard/farm-map')]]

/** Sections per role: [label, items]. */
export const NAV = {
  farmer: [
    overview,
    records(),
    community,
    ['Marketplace', [item('Beans', 'beans', '/dashboard/beans'), item('Orders', 'orders', '/dashboard/orders'), item('Store', 'store', '/products', { external: true })]],
    map,
  ],
  group_manager: [
    overview,
    records(item('Farmers', 'farmers', '/dashboard/farmers', { badge: 'farmers', alert: true })),
    community,
    ['Marketplace', [item('Beans', 'beans', '/dashboard/beans')]],
    map,
    ['Insights', [item('Reports', 'reports', '/dashboard/reports')]],
  ],
  kaluppa: [
    overview,
    records(item('Group Managers', 'gms', '/dashboard/group-managers'), item('Associations', 'assoc', '/dashboard/associations')),
    community,
    [
      'Marketplace',
      [
        item('Beans', 'beans', '/dashboard/beans', { badge: 'beans', alert: true }),
        item('Orders', 'orders', '/dashboard/orders', { badge: 'orders', alert: true }),
        item('Inventory', 'inventory', '/dashboard/inventory'),
        item('Reviews', 'reviews', '/dashboard/reviews', { badge: 'reviews' }),
      ],
    ],
    map,
    [
      'System',
      [
        item('Reports', 'reports', '/dashboard/reports'),
        item('Contact messages', 'contact', '/dashboard/contact-messages'),
        item('Audit log', 'audit', '/dashboard/audit-log'),
        item('Settings', 'settings', '/dashboard/settings'),
      ],
    ],
  ],
}

/** Roles whose top bar shows the cart button (DashTopbar.dc.html: farmers only; Kaluppa passes every permission check). */
export const TOPBAR_CART = new Set(['farmer'])
/** Roles that get the "Join your association" window (Kaluppa passes `association.request` as super-admin, so not by permission). */
export const ASSOCIATION_WINDOW = new Set(['farmer'])

/** Account settings tabs (FarmerAssociation.dc.html). Role-keyed like the nav: Kaluppa passes every permission check. */
// Account settings pill bar (ACCOUNT_NAV in FarmerAssociation.dc.html). `icon` keys NAV_ICONS-style names in AccountSettings.
const BASE_TABS = [
  { to: 'profile', label: 'Profile', icon: 'profile', description: 'Your name, photo and contact number.' },
  { to: 'security', label: 'Security', icon: 'security', description: 'Your email and password.' },
]
export const ACCOUNT_TABS = {
  farmer: [
    ...BASE_TABS,
    { to: 'association', label: 'Association', icon: 'association', description: 'Your association, your Group Manager, your documents and transfers.' },
    { to: 'addresses', label: 'Addresses', icon: 'addresses', description: 'Where Kaluppa delivers your beans and fertilizer. Your default address is picked first at checkout.' },
  ],
  group_manager: BASE_TABS,
  kaluppa: BASE_TABS,
}

const ACCOUNT_CRUMBS = { profile: 'Profile', security: 'Security', addresses: 'Addresses', association: 'Association' }

/** Breadcrumb [section, page] for a dashboard path. */
export function crumbsFor(role, pathname) {
  const [, , page, sub] = pathname.split('/')
  if (page === 'account') return ['Account settings', ACCOUNT_CRUMBS[sub] ?? 'Profile']
  // Kaluppa lists Reports under System, but the page's crumb is Insights for everyone (Reports.dc.html).
  if (page === 'reports') return ['Insights', 'Reports']
  for (const [section, items] of NAV[role] ?? []) {
    const hit = items.find((i) => !i.external && i.to === `/dashboard/${page}`)
    if (hit) return [section, hit.label]
  }
  return ['Dashboard', 'Overview']
}
