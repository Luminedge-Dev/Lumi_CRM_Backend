import mongoose, { Schema, Document } from 'mongoose';

export type NewsCategory = 'General' | 'IELTS' | 'Study Abroad' | 'Visa' | 'Event' | 'Scholarship';

export interface INewsUpdate extends Document {
  title: string;
  content: string;
  category: NewsCategory;
  isPinned: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NewsUpdateSchema = new Schema<INewsUpdate>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['General', 'IELTS', 'Study Abroad', 'Visa', 'Event', 'Scholarship'],
      default: 'General',
    },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<INewsUpdate>('NewsUpdate', NewsUpdateSchema);
