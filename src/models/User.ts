import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  employeeId?: string;
  reportingTo?: mongoose.Types.ObjectId;
  joinDate?: Date;
  role: 'admin' | 'bdm';
  avatarUrl?: string;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    phone: {
      type: String,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    reportingTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    joinDate: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['admin', 'bdm'],
      default: 'bdm',
    },
    avatarUrl: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);
