import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  entityType: 'contact' | 'deal' | 'company' | 'lead';
  entityId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
  assignedToType?: 'student' | 'staff';
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo: mongoose.Types.ObjectId;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    entityType: { type: String, enum: ['contact', 'deal', 'company', 'lead'], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    assignedToType: { type: String, enum: ['student', 'staff'] },
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<ITask>('Task', TaskSchema);
