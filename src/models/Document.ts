import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export type DocumentType =
  | 'Passport' | 'National ID' | 'Birth Certificate' | 'Transcript'
  | 'Certificate' | 'Recommendation Letter' | 'SOP' | 'LOR' | 'CV'
  | 'Bank Statement' | 'Sponsor Documents' | 'Visa Form'
  | 'Medical Report' | 'Police Clearance' | 'Other';

export type DocumentStatus =
  | 'Requested' | 'Uploaded' | 'Under Review' | 'Approved' | 'Rejected' | 'Revision Requested';

export interface IDocument extends MongoDocument {
  studentId: mongoose.Types.ObjectId;
  applicationId?: mongoose.Types.ObjectId;
  documentType: DocumentType;
  fileName: string;
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
  filePath?: string;
  uploadedBy: 'student' | 'staff';
  status: DocumentStatus;
  requestedBy?: string;
  requestNote?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    documentType: {
      type: String,
      enum: ['Passport', 'National ID', 'Birth Certificate', 'Transcript', 'Certificate',
        'Recommendation Letter', 'SOP', 'LOR', 'CV', 'Bank Statement', 'Sponsor Documents',
        'Visa Form', 'Medical Report', 'Police Clearance', 'Other'],
      required: true,
    },
    fileName: { type: String, required: true },
    originalName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    filePath: { type: String },
    uploadedBy: { type: String, enum: ['student', 'staff'], default: 'student' },
    status: {
      type: String,
      enum: ['Requested', 'Uploaded', 'Under Review', 'Approved', 'Rejected', 'Revision Requested'],
      default: 'Requested',
    },
    requestedBy: { type: String },
    requestNote: { type: String },
    reviewedBy: { type: String },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

DocumentSchema.index({ studentId: 1 });
DocumentSchema.index({ applicationId: 1 });

export default mongoose.model<IDocument>('Document', DocumentSchema);
