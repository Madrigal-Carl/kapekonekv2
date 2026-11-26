import mongoose from 'mongoose';

export const CONVERSATION_TYPES = ['kaluppa', 'direct', 'group'];

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    association: { type: mongoose.Schema.Types.ObjectId, ref: 'Association', default: null },
    // One key per chat, so it can't be created twice: `kaluppa:<userId>`, `group:<associationId>`, `direct:<a>:<b>` (sorted ids).
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, text: String, sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date },
  },
  { timestamps: true },
);

export const Conversation = mongoose.models.Conversation ?? mongoose.model('Conversation', conversationSchema);
