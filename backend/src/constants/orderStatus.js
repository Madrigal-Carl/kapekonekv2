/** Order statuses and enums (PRODUCT-SPEC §3). */
export const ORDER_STATUSES = [
  'pending', 'reserved', 'processing', 'out_for_delivery', 'ready_for_pickup',
  'sold', 'cancelled', 'rejected', 'expired',
];
/** Dashboard Status dropdown groups (PHASE-2-SPEC §3.8). */
export const ORDER_GROUPS = {
  to_confirm: ['pending'],
  preparing: ['reserved', 'processing'],
  on_the_way: ['out_for_delivery', 'ready_for_pickup'],
  completed: ['sold'],
  closed: ['cancelled', 'rejected', 'expired'],
};
export const FINAL_STATUSES = ['sold', 'cancelled', 'rejected', 'expired'];
export const FULFILLMENT_METHODS = ['delivery', 'pickup'];
export const PAYMENT_METHODS = ['e_wallet', 'cash'];
export const EWALLET_PROVIDERS = ['GCash', 'Maya'];
export const REFUND_STATUSES = ['not_applicable', 'pending', 'refunded'];

export const STATUS_LABELS = {
  pending: 'Pending',
  reserved: 'Reserved',
  processing: 'Processing',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  sold: 'Sold',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
};

/** Reason codes by who acts (PRODUCT-SPEC §3). `other` needs a written reason. */
export const BUYER_CANCEL_REASONS = {
  change_delivery_address: 'Need to change the delivery address',
  change_items: 'Want to change items or quantity',
  wrong_receipt: 'Uploaded the wrong receipt',
  ordered_by_mistake: 'Ordered by mistake',
  other: 'Other',
};
export const REJECT_REASONS = {
  invalid_receipt: 'The receipt could not be verified',
  amount_mismatch: 'The amount paid does not match the total',
  out_of_stock: 'Some items are out of stock',
  outside_delivery_area: 'The address is outside the delivery area',
  other: 'Other',
};
export const STAFF_CANCEL_REASONS = {
  uncollected: 'The order was not picked up',
  undeliverable: 'The order could not be delivered',
  out_of_stock: 'Some items are out of stock',
  other: 'Other',
};
