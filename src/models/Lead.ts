import mongoose, { Schema, Document } from 'mongoose';
import { canonicalizePhoneValue } from '../utils/phone.util';

export interface IFollowUp {
  date?: Date;
  note?: string;
  nextFollowUpDate?: Date;
  createdAt?: Date;
}

export interface ILead extends Document {
  fullName?: string;
  email?: string;
  phone: string;
  whom?: 'Personal' | 'Parents' | 'Cousin' | 'Uncle' | 'Sibling' | 'Spouse';
  /** Original BDM name from a bulk CSV import, for leads with no matching User account yet. */
  bdmName?: string;
  source: 'Education Team' | 'Phone Call' | 'Previous' | 'Facebook' | 'WhatsApp' | 'Google' | 'Walk-in' | 'Event' | 'Reference' | 'Others' | 'Website';
  serviceInterest: (
    'IELTS Reg' | 'PTE Reg' | 'TOEFL Reg' | 'GRE Reg' | 'Duolingo Reg' |
    'IELTS Premium' | 'IELTS Crash' | 'IELTS Intense' | 'IELTS 1 Module' | 'IELTS 1-on-1' | 'IELTS Mock Tests' |
    'PTE Premium' | 'PTE Crash' | 'PTE Intense' | 'PTE 1 Module' | 'PTE 1-on-1' | 'PTE Mock Tests' |
    'TOEFL Premium' | 'TOEFL Crash' | 'TOEFL 1 Module' | 'TOEFL 1-on-1' | 'TOEFL Mock Tests' |
    'GRE Premium' | 'GRE Quant' | 'GRE Verbal' | 'GRE 1-on-1' | 'GRE Mock Tests' | 'GRE Portal' |
    'Basic English' | 'Spoken' | 'Service Charge' | 'SSC English' | 'Study Abroad' | 'Others'
  )[];
  assignedTo?: mongoose.Types.ObjectId;
  notes?: string;
  followUps: IFollowUp[];
  lifecycleStage: 'New Inquiry' | 'Contacted' | 'Trial Class' | 'Enrolled' | 'Lost';
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    date: { type: Date },
    note: { type: String },
    nextFollowUpDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const LeadSchema = new Schema<ILead>(
  {
    fullName: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      unique: true,
      set: canonicalizePhoneValue
    },
    whom: {
      type: String,
      enum: ['Personal', 'Parents', 'Cousin', 'Uncle', 'Sibling', 'Spouse']
    },
    source: {
      type: String,
      enum: ['Education Team', 'Phone Call', 'Previous', 'Facebook', 'WhatsApp', 'Google', 'Walk-in', 'Event', 'Reference', 'Others', 'Website'],
      default: 'Website'
    },
    serviceInterest: [{
      type: String,
      enum: [
        'IELTS Reg', 'PTE Reg', 'TOEFL Reg', 'GRE Reg', 'Duolingo Reg',
        'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS 1 Module', 'IELTS 1-on-1', 'IELTS Mock Tests',
        'PTE Premium', 'PTE Crash', 'PTE Intense', 'PTE 1 Module', 'PTE 1-on-1', 'PTE Mock Tests',
        'TOEFL Premium', 'TOEFL Crash', 'TOEFL 1 Module', 'TOEFL 1-on-1', 'TOEFL Mock Tests',
        'GRE Premium', 'GRE Quant', 'GRE Verbal', 'GRE 1-on-1', 'GRE Mock Tests', 'GRE Portal',
        'Basic English', 'Spoken', 'Service Charge', 'SSC English', 'Study Abroad', 'Others',
      ]
    }],
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    bdmName: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    followUps: {
      type: [FollowUpSchema],
      default: []
    },
    lifecycleStage: {
      type: String,
      enum: ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'],
      default: 'New Inquiry'
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying
LeadSchema.index({ email: 1 });
LeadSchema.index({ lifecycleStage: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ lifecycleStage: 1, createdAt: -1 });
LeadSchema.index({ lifecycleStage: 1, updatedAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ serviceInterest: 1, createdAt: -1 });
LeadSchema.index({ fullName: 'text', email: 'text' });
LeadSchema.index({ 'followUps.nextFollowUpDate': 1 });
LeadSchema.index({ bdmName: 1 });

export default mongoose.model<ILead>('Lead', LeadSchema);
