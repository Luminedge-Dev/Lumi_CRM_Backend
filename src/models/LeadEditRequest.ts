import mongoose, { Schema, Document } from 'mongoose';

export type LeadEditRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ILeadEditRequest extends Document {
  leadId: mongoose.Types.ObjectId;
  section: string;
  payload: Record<string, any>;
  note?: string;
  status: LeadEditRequestStatus;
  requestedBy?: mongoose.Types.ObjectId;
  requestedByName?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  leadSnapshot?: {
    fullName?: string;
    email?: string;
    phone?: string;
    lifecycleStage?: string;
    source?: string;
    serviceInterest?: string[];
    assignedTo?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LeadEditRequestSchema = new Schema<ILeadEditRequest>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    note: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    requestedByName: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNote: {
      type: String,
      trim: true,
    },
    leadSnapshot: {
      fullName: { type: String },
      email: { type: String },
      phone: { type: String },
      lifecycleStage: { type: String },
      source: { type: String },
      serviceInterest: [{ type: String }],
      assignedTo: { type: String },
    },
  },
  { timestamps: true }
);

LeadEditRequestSchema.index({ leadId: 1, status: 1, createdAt: -1 });
LeadEditRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });

export default mongoose.model<ILeadEditRequest>('LeadEditRequest', LeadEditRequestSchema);
