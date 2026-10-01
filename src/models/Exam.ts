import mongoose, { Schema, Document } from 'mongoose';

export interface IExam extends Document {
  name: string;
  examType: string;
  testType: string;
  examDate: Date;
  examTime: string;
  venue: string;
  registrationDeadline: Date;
  fee: number;
  currency: string;
  totalSlots: number;
  availableSlots: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
  {
    name: { type: String, required: true },
    examType: {
      type: String,
      enum: ['Computer-Based', 'Paper-Based'],
      required: true,
    },
    testType: {
      type: String,
      enum: ['IELTS', 'PTE', 'GRE', 'TOEFL'],
      required: true,
    },
    examDate: { type: Date, required: true },
    examTime: { type: String, required: true },
    venue: { type: String, required: true },
    registrationDeadline: { type: Date, required: true },
    fee: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BDT' },
    totalSlots: { type: Number, required: true, min: 1 },
    availableSlots: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IExam>('Exam', ExamSchema);
