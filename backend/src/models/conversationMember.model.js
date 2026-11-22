import mongoose from 'mongoose';

const conversationMemberSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    team: { type: String, enum: ['kaluppa', null], default: null }, // the virtual `team:kaluppa` member of Kaluppa chats
    canPost: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    lastDeliveredAt: { type: Date, default: null },
    lastReadAt: { type: Date, default: null },
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
conversationMemberSchema.index({ conversation: 1, user: 1, team: 1 }, { unique: true });
conversationMemberSchema.index({ user: 1, updatedAt: -1 });

export const ConversationMember = mongoose.models.ConversationMember ?? mongoose.model('ConversationMember', conversationMemberSchema);
