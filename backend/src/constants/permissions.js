/** Permission slug → display name and group (PRODUCT-SPEC §1). */
export const PERMISSIONS = {
  'catalog.coffee': { name: 'Buy coffee', group: 'catalog' },
  'catalog.farm_supplies': { name: 'Buy fertilizer and seedlings', group: 'catalog' },
  'cart.manage': { name: 'Manage cart', group: 'cart' },
  'addresses.manage': { name: 'Manage addresses', group: 'addresses' },
  'orders.create': { name: 'Place orders', group: 'orders' },
  'orders.view_own': { name: 'View own orders', group: 'orders' },
  'orders.cancel_own': { name: 'Cancel own orders', group: 'orders' },
  'orders.manage': { name: 'Manage all orders', group: 'orders' },
  'reviews.create': { name: 'Write reviews', group: 'reviews' },
  'reviews.update_own': { name: 'Edit own reviews', group: 'reviews' },
  'notifications.view': { name: 'View notifications', group: 'notifications' },
  'profile.update': { name: 'Update profile', group: 'account' },
  'dashboard.view': { name: 'View dashboard', group: 'dashboard' },
  'settings.manage': { name: 'Manage settings', group: 'settings' },
  'posts.react': { name: 'React to posts', group: 'posts' },
  'posts.comment': { name: 'Comment on posts', group: 'posts' },
  'posts.create': { name: 'Create posts', group: 'posts' },
};

export const ROLES = { KALUPPA: 'kaluppa', GROUP_MANAGER: 'group_manager', FARMER: 'farmer', BUYER: 'buyer' };

export const ROLE_LABELS = {
  kaluppa: 'Kaluppa',
  group_manager: 'Group Manager',
  farmer: 'Farmer',
  buyer: 'Buyer',
};

const everyone = ['notifications.view', 'profile.update'];
const community = ['dashboard.view', 'posts.react', 'posts.comment', 'posts.create'];

/** Role slug → permission slugs. Kaluppa also passes every check as super-admin. */
export const ROLE_PERMISSIONS = {
  buyer: [
    'catalog.coffee', 'cart.manage', 'addresses.manage',
    'orders.create', 'orders.view_own', 'orders.cancel_own',
    'reviews.create', 'reviews.update_own', ...everyone,
  ],
  farmer: ['catalog.farm_supplies', ...everyone, ...community],
  group_manager: [...everyone, ...community],
  kaluppa: Object.keys(PERMISSIONS),
};

/** Roles a visitor may pick at signup. */
export const SIGNUP_ROLES = [ROLES.BUYER, ROLES.FARMER];
