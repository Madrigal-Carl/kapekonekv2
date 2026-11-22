// Dashboard navigation (Sidebar.dc.html). The role picks which nav the user sees (routing);
// each page's route still checks its own permission.

/** 24×24 stroke icon paths from Sidebar.dc.html. */
export const NAV_ICONS = {
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  farm: 'M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
  tree: 'M12 22v-6M12 2 5 11h4l-5 5h16l-5-5h4z',
  harvest: 'M2 22 16 8M3.5 12.5 5 11l1.5 1.5a3.5 3.5 0 0 1 0 5L5 19l-1.5-1.5a3.5 3.5 0 0 1 0-5zM7.5 8.5 9 7l1.5 1.5a3.5 3.5 0 0 1 0 5L9 15l-1.5-1.5a3.5 3.5 0 0 1 0-5zM11.5 4.5 13 3l1.5 1.5a3.5 3.5 0 0 1 0 5L13 11l-1.5-1.5a3.5 3.5 0 0 1 0-5zM20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4z',
  farmers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  gms: 'M2 21v-2a4 4 0 0 1 4-4h5M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM16 18l2 2 4-4',
  assoc: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  inbox: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  hub: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z',
  beans: 'M12 3c-4.5 1.5-7 5.5-6 10s5 8 9 8M12 3c4.5 1 7.5 4.5 7 9.5S14.5 21 15 21M12 3c-1.5 3 1.5 5.5 0 9s1.5 6.5 3 9',
  orders: 'M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01',
  store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
  inventory: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12',
  map: 'M14.1 6.3 9.9 4.2a2 2 0 0 0-1.8 0L3.6 6.4A1 1 0 0 0 3 7.3v12.9a1 1 0 0 0 1.4.9l3.7-1.9a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.2a1 1 0 0 0 .6-.9V5.3a1 1 0 0 0-1.4-.9l-3.7 1.9a2 2 0 0 1-1.8 0zM9 4v15M15 6v15',
  reports: 'M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V5',
  audit: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  reviews: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  // overview KPI tiles and banners
  peso: 'M7 21V3h6a5 5 0 0 1 0 10H7M4 7h16M4 10h16',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  rejected: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM15 9l-6 6M9 9l6 6',
  plus: 'M12 5v14M5 12h14',
}

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
    ['System', [item('Reports', 'reports', '/dashboard/reports'), item('Audit log', 'audit', '/dashboard/audit-log'), item('Settings', 'settings', '/dashboard/settings')]],
  ],
}

/** Roles whose top bar shows the cart button (DashTopbar.dc.html: farmers only; Kaluppa passes every permission check). */
export const TOPBAR_CART = new Set(['farmer'])

const ACCOUNT_CRUMBS = { profile: 'Profile', security: 'Security', addresses: 'Addresses', association: 'Association' }

/** Breadcrumb [section, page] for a dashboard path. */
export function crumbsFor(role, pathname) {
  const [, , page, sub] = pathname.split('/')
  if (page === 'account') return ['Account', ACCOUNT_CRUMBS[sub] ?? 'Settings']
  for (const [section, items] of NAV[role] ?? []) {
    const hit = items.find((i) => !i.external && i.to === `/dashboard/${page}`)
    if (hit) return [section, hit.label]
  }
  return ['Dashboard', 'Overview']
}
