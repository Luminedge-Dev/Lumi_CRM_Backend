import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'University Applied'
  | 'Offer Received' | 'Accepted' | 'Tuition Paid' | 'COE Received'
  | 'Visa Applied' | 'Visa Granted';

interface IStageHistory {
  status: ApplicationStatus;
  changedBy: string;
  changedAt: Date;
  note?: string;
}

export interface IApplication extends Document {
  studentId: mongoose.Types.ObjectId;
  serviceType: 'Language Prep' | 'Study Abroad' | 'Migration' | 'Visa' | 'Career';
  serviceDetail?: string;
  targetCountry?: string;
  targetUniversity?: string;
  targetCourse?: string;
  preferredIntake?: string;
  status: ApplicationStatus;
  assignedBDM?: mongoose.Types.ObjectId;
  stageHistory: IStageHistory[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StageHistorySchema = new Schema<IStageHistory>({
  status: { type: String },
  changedBy: { type: String },
  changedAt: { type: Date, default: Date.now },
  note: { type: String },
}, { _id: false });

const ApplicationSchema = new Schema<IApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    serviceType: {
      type: String,
      enum: ['Language Prep', 'Study Abroad', 'Migration', 'Visa', 'Career'],
      required: true,
    },
    serviceDetail: { type: String },
    targetCountry: { type: String },
    targetUniversity: { type: String },
    targetCourse: { type: String },
    preferredIntake: { type: String },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Under Review', 'University Applied', 'Offer Received',
        'Accepted', 'Tuition Paid', 'COE Received', 'Visa Applied', 'Visa Granted'],
      default: 'Submitted',
    },
    assignedBDM: { type: Schema.Types.ObjectId, ref: 'User' },
    stageHistory: { type: [StageHistorySchema], default: [] },
    notes: { type: String },
  },
  { timestamps: true }
);

ApplicationSchema.index({ studentId: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ assignedBDM: 1 });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
