import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderType: 'student' | 'staff';
  senderId: string;
  senderName: string;
  content: string;
  attachmentUrl?: string;
  readBy: string[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderType: { type: String, enum: ['student', 'staff'], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    content: { type: String, required: true },
    attachmentUrl: { type: String },
    readBy: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
