import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  { url: String, publicId: String, name: String, bytes: Number, kind: { type: String, enum: ['image', 'file'] } },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    editedAt: { type: Date, default: null },
    deletedForEveryoneAt: { type: Date, default: null }, // tombstone: body and attachments are cleared
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // users who chose "Delete for me"
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.models.Message ?? mongoose.model('Message', messageSchema);
