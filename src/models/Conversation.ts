import mongoose, { Schema, Document } from 'mongoose';

interface IParticipant {
  participantId: string;
  participantType: 'student' | 'staff';
  name: string;
  role: string;
}

export interface IConversation extends Document {
  participants: IParticipant[];
  applicationId?: mongoose.Types.ObjectId;
  title: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCounts: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  participantId: { type: String, required: true },
  participantType: { type: String, enum: ['student', 'staff'], required: true },
  name: { type: String, required: true },
  role: { type: String, default: '' },
}, { _id: false });

const ConversationSchema = new Schema<IConversation>(
  {
    participants: { type: [ParticipantSchema], required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    title: { type: String, default: 'Conversation' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
