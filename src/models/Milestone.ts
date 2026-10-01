import mongoose, { Schema, Document } from 'mongoose';

export type MilestoneStatus = 'Pending' | 'In Progress' | 'Completed' | 'Blocked';

export interface IMilestone extends Document {
  studentId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  serviceType: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  order: number;
  completedAt?: Date;
  updatedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    serviceType: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Blocked'],
      default: 'Pending',
    },
    order: { type: Number, required: true },
    completedAt: { type: Date },
    updatedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

MilestoneSchema.index({ studentId: 1, applicationId: 1 });

export const MILESTONE_TEMPLATES: Record<string, string[]> = {
  'Study Abroad': [
    'BDM Assigned',
    'Document Collection',
    'SOP/LOR Writing',
    'University Applications',
    'Offer Letter Received',
    'Tuition Paid',
    'COE/CAS Received',
    'Visa Applied',
    'Visa Granted',
    'Flight Booked',
    'Accommodation Arranged',
    'Arrival Support',
    'Migration Completed',
  ],
  'Language Prep': [
    'Enrolled',
    'Course Started',
    'Mid-Mock Test',
    'Final Mock Test',
    'Exam Registered',
    'Exam Completed',
    'Result Received',
  ],
  'Visa': [
    'Application Received',
    'Documents Collected',
    'Application Submitted',
    'Under Processing',
    'Decision Received',
  ],
  'Career': [
    'Resume Reviewed',
    'LinkedIn Optimised',
    'Job Applications Sent',
    'Interview Scheduled',
    'Job Secured',
  ],
  'Migration': [
    'Assessment Complete',
    'Documents Collected',
    'Application Submitted',
    'Skills Assessment',
    'Visa Applied',
    'Visa Granted',
    'Migration Completed',
  ],
};

export default mongoose.model<IMilestone>('Milestone', MilestoneSchema);
