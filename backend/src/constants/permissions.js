/** Permission slug → display name and group (PRODUCT-SPEC §1). */
export const PERMISSIONS = {
  'catalog.coffee': { name: 'Buy coffee', group: 'catalog' },
  'catalog.farm_supplies': { name: 'Buy fertilizer and beans', group: 'catalog' },
  'cart.manage': { name: 'Manage cart', group: 'cart' },
  'addresses.manage': { name: 'Manage addresses', group: 'addresses' },
  'orders.create': { name: 'Place orders', group: 'orders' },
  'orders.view_own': { name: 'View own orders', group: 'orders' },
  'orders.cancel_own': { name: 'Cancel own orders', group: 'orders' },
  'orders.manage': { name: 'Manage all orders', group: 'orders' },
  'reviews.create': { name: 'Write reviews', group: 'reviews' },
  'reviews.update_own': { name: 'Edit own reviews', group: 'reviews' },
  'reviews.delete_own': { name: 'Delete own reviews', group: 'reviews' },
  'notifications.view': { name: 'View notifications', group: 'notifications' },
  'profile.update': { name: 'Update profile', group: 'account' },
  'dashboard.view': { name: 'View dashboard', group: 'dashboard' },
  'settings.manage': { name: 'Manage settings', group: 'settings' },
  'contact.view': { name: 'Read Contact us messages', group: 'settings' }, // Change 08
  'posts.react': { name: 'React to posts', group: 'posts' },
  'posts.comment': { name: 'Comment on posts', group: 'posts' },
  'posts.create': { name: 'Create posts', group: 'posts' },
  // Phase 2 (PHASE-2-SPEC §2)
  'inbox.use': { name: 'Use the inbox', group: 'inbox' },
  'map.view': { name: 'View the farm map', group: 'map' },
  'association.request': { name: 'Ask to join an association', group: 'farmers' },
  'farmers.manage': { name: 'Manage farmers', group: 'farmers' },
  'farmers.approve': { name: 'Approve farmers', group: 'farmers' },
  'group_managers.manage': { name: 'Manage Group Managers', group: 'accounts' },
  'users.reset_password': { name: 'Reset a Group Manager’s password', group: 'accounts' },
  'farmers.reset_password': { name: 'Reset a farmer’s password', group: 'farmers' },
  'associations.manage': { name: 'Manage associations', group: 'accounts' },
  'farms.manage': { name: 'Manage farms', group: 'records' },
  'trees.manage': { name: 'Manage trees', group: 'records' },
  'harvests.manage': { name: 'Manage harvests', group: 'records' },
  'records.view_all': { name: 'View every record', group: 'records' },
  'beans.sell': { name: 'Sell beans to Kaluppa', group: 'beans' },
  'beans.review': { name: 'Review bean listings', group: 'beans' },
  'inventory.manage': { name: 'Manage inventory', group: 'inventory' },
  'reviews.moderate': { name: 'Moderate product reviews', group: 'reviews' },
  'posts.moderate': { name: 'Remove posts and comments', group: 'posts' },
  'audit.view': { name: 'View the audit log', group: 'audit' },
  'reports.view': { name: 'View reports', group: 'reports' },
};

export const ROLES = { KALUPPA: 'kaluppa', GROUP_MANAGER: 'group_manager', FARMER: 'farmer', BUYER: 'buyer' };

export const ROLE_LABELS = {
  kaluppa: 'Kaluppa',
  group_manager: 'Group Manager',
  farmer: 'Farmer',
  buyer: 'Buyer',
};

const everyone = ['notifications.view', 'profile.update'];
const dashboard = ['dashboard.view', 'inbox.use', 'posts.create', 'posts.react', 'posts.comment', 'map.view'];
const records = ['farms.manage', 'trees.manage', 'harvests.manage'];
const shop = [
  'cart.manage', 'addresses.manage', 'orders.create', 'orders.view_own', 'orders.cancel_own',
  'reviews.create', 'reviews.update_own', 'reviews.delete_own',
];
const notForKaluppa = new Set(['association.request', 'beans.sell']); // the farmer side of flows Kaluppa reviews

/** Role slug → permission slugs. Kaluppa also passes every check as super-admin. */
export const ROLE_PERMISSIONS = {
  buyer: ['catalog.coffee', ...shop, ...everyone],
  farmer: [...everyone, ...dashboard, 'association.request', ...records, 'beans.sell', 'catalog.farm_supplies', ...shop],
  group_manager: [...everyone, ...dashboard, 'farmers.manage', 'farmers.approve', 'farmers.reset_password', ...records, 'beans.sell', 'reports.view'],
  kaluppa: Object.keys(PERMISSIONS).filter((slug) => !notForKaluppa.has(slug)),
};

/** Roles a visitor may pick at signup. */
export const SIGNUP_ROLES = [ROLES.BUYER, ROLES.FARMER];
