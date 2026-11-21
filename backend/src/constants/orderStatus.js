/** Order statuses and enums (PRODUCT-SPEC §3). */
export const ORDER_STATUSES = [
  'pending', 'reserved', 'processing', 'out_for_delivery', 'ready_for_pickup',
  'sold', 'cancelled', 'rejected', 'expired',
];
export const FINAL_STATUSES = ['sold', 'cancelled', 'rejected', 'expired'];
export const FULFILLMENT_METHODS = ['delivery', 'pickup'];
export const PAYMENT_METHODS = ['e_wallet', 'cash'];
export const EWALLET_PROVIDERS = ['GCash', 'Maya'];
export const REFUND_STATUSES = ['not_applicable', 'pending', 'refunded'];
