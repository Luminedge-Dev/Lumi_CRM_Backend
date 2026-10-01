import mongoose, { Schema, Document } from 'mongoose';

interface IPricing {
  testCount: number;
  fee: number;
}

export interface IMockTestPackage extends Document {
  testType: string;
  features: string[];
  pricing: IPricing[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MockTestPackageSchema = new Schema<IMockTestPackage>(
  {
    testType: {
      type: String,
      enum: ['IELTS', 'PTE', 'GRE', 'TOEFL'],
      required: true,
      unique: true,
    },
    features: [{ type: String }],
    pricing: [{
      testCount: { type: Number, required: true },
      fee: { type: Number, required: true },
    }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IMockTestPackage>('MockTestPackage', MockTestPackageSchema);
