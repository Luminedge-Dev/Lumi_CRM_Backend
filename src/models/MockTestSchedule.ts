import mongoose, { Schema, Document } from 'mongoose';

export interface IMockTestSchedule extends Document {
  listNumber: number;
  name: string;
  testType: string;
  examDate: Date;
  examTime: string;
  totalSeats: number;
  availableSeats: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const MockTestScheduleSchema = new Schema<IMockTestSchedule>(
  {
    listNumber: { type: Number, required: true },
    name: { type: String, required: true },
    testType: {
      type: String,
      enum: ['IELTS', 'PTE', 'GRE', 'TOEFL'],
      required: true,
    },
    examDate: { type: Date, required: true },
    examTime: { type: String, required: true },
    totalSeats: { type: Number, required: true, min: 1 },
    availableSeats: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IMockTestSchedule>('MockTestSchedule', MockTestScheduleSchema);
