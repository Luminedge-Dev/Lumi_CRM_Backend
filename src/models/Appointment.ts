import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentType = 'Counseling' | 'Visa Consultation' | 'Interview Prep' | 'Language Course Meeting';
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';

export interface IAppointment extends Document {
  studentId: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  staffType?: 'bdm';
  type: AppointmentType;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User' },
    staffType: { type: String, enum: ['bdm'] },
    type: {
      type: String,
      enum: ['Counseling', 'Visa Consultation', 'Interview Prep', 'Language Course Meeting'],
      required: true,
    },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'],
      default: 'Scheduled',
    },
    notes: { type: String },
    meetingLink: { type: String },
  },
  { timestamps: true }
);

AppointmentSchema.index({ studentId: 1 });
AppointmentSchema.index({ staffId: 1 });
AppointmentSchema.index({ scheduledAt: 1 });

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);
