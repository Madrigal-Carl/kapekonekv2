import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'order_status', 'order_new', 'system',
  // Phase 2 (PHASE-2-SPEC §4)
  'farmer_request', 'farmer_decision', 'transfer_decision', 'bean_status', 'message', 'post_activity', 'post_removed', 'review_activity',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
