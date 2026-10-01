import mongoose, { Schema, Document } from 'mongoose';

export interface ICourse extends Document {
  name: string;
  testType: string;
  description: string;
  durationMonths: number;
  enrolledCount: number;
  capacity: number;
  startDate: Date;
  price: number;
  currency: string;
  instructor: string;
  schedule: string;
  syllabus: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true },
    testType: {
      type: String,
      enum: [
        // specific course types
        'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS Elementary', 'IELTS Mock Test',
        'Basic English', 'GRE Premium', 'TOEFL Premium', 'PTE Premium',
        // legacy broad values — kept so existing documents remain valid
        'IELTS', 'PTE', 'GRE', 'TOEFL',
      ],
      required: true,
    },
    description: { type: String, default: '' },
    durationMonths: { type: Number, required: true, min: 1 },
    enrolledCount: { type: Number, default: 0 },
    capacity: { type: Number, default: 50 },
    startDate: { type: Date, default: Date.now },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'BDT' },
    instructor: { type: String, default: '' },
    schedule: { type: String, default: '' },
    syllabus: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICourse>('Course', CourseSchema);
