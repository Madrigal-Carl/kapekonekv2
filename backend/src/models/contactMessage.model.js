import mongoose from 'mongoose';
import { CONTACT_TOPICS } from '../schemas/rules.js';

/** A Contact us message (Change 08). Kaluppa reads them in the dashboard; they're also emailed to the branch. */
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    topic: { type: String, enum: CONTACT_TOPICS, required: true },
    orderNumber: { type: String, default: null },
    message: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // when sent signed in
  },
  { timestamps: true },
);
contactMessageSchema.index({ createdAt: -1, _id: -1 });

export const ContactMessage = mongoose.models.ContactMessage ?? mongoose.model('ContactMessage', contactMessageSchema);
