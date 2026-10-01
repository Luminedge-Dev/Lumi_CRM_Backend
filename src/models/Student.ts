import mongoose, { Schema, Document } from 'mongoose';

interface IAcademicRecord {
  level: 'SSC' | 'HSC' | 'Diploma' | 'Bachelor' | 'Master';
  institution: string;
  board?: string;
  result?: string;
  year?: number;
}

interface IEnglishTest {
  type: 'IELTS' | 'PTE' | 'TOEFL' | 'Duolingo';
  score?: string;
  testDate?: Date;
  expiryDate?: Date;
}

interface IFinancialInfo {
  sponsorName?: string;
  sponsorRelation?: string;
  fundingSource?: string;
  estimatedBudget?: string;
}

interface IStudyPreferences {
  country?: string;
  university?: string;
  course?: string;
  budgetRange?: string;
  intakeYear?: string;
  intakeSemester?: string;
}

export interface IStudent extends Document {
  name: string;
  email: string;
  role: 'student';
  avatarUrl?: string;
  passwordHash?: string;
  phone?: string;
  // Registration extras
  serviceCategory?: 'Language Prep' | 'Study Abroad' | 'Migration' | 'Visa' | 'Career';
  referralSource?: string;
  preferredCountry?: string;
  preferredIntake?: string;
  // Personal
  dateOfBirth?: Date;
  gender?: string;
  nationality?: string;
  nativeLanguage?: string;
  currentAddress?: string;
  passportNumber?: string;
  passportExpiry?: Date;
  emergencyContact?: string;
  // Academic
  academicRecords?: IAcademicRecord[];
  englishTest?: IEnglishTest;
  // Financial
  financialInfo?: IFinancialInfo;
  // Study preferences
  studyPreferences?: IStudyPreferences;
  // Assigned staff
  assignedBDM?: mongoose.Types.ObjectId;
  // Legacy
  linkedLeadId?: mongoose.Types.ObjectId;
  // Status
  onboardingComplete: boolean;
  isActive: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicRecordSchema = new Schema<IAcademicRecord>({
  level: { type: String, enum: ['SSC', 'HSC', 'Diploma', 'Bachelor', 'Master'] },
  institution: { type: String },
  board: { type: String },
  result: { type: String },
  year: { type: Number },
}, { _id: false });

const EnglishTestSchema = new Schema<IEnglishTest>({
  type: { type: String, enum: ['IELTS', 'PTE', 'TOEFL', 'Duolingo'] },
  score: { type: String },
  testDate: { type: Date },
  expiryDate: { type: Date },
}, { _id: false });

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['student'], default: 'student' },
    avatarUrl: { type: String },
    passwordHash: { type: String },
    phone: { type: String, trim: true },
    serviceCategory: { type: String, enum: ['Language Prep', 'Study Abroad', 'Migration', 'Visa', 'Career'] },
    referralSource: { type: String },
    preferredCountry: { type: String },
    preferredIntake: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String },
    nationality: { type: String },
    nativeLanguage: { type: String },
    currentAddress: { type: String },
    passportNumber: { type: String },
    passportExpiry: { type: Date },
    emergencyContact: { type: String },
    academicRecords: { type: [AcademicRecordSchema], default: [] },
    englishTest: { type: EnglishTestSchema },
    financialInfo: {
      sponsorName: String,
      sponsorRelation: String,
      fundingSource: String,
      estimatedBudget: String,
    },
    studyPreferences: {
      country: String,
      university: String,
      course: String,
      budgetRange: String,
      intakeYear: String,
      intakeSemester: String,
    },
    assignedBDM: { type: Schema.Types.ObjectId, ref: 'User' },
    linkedLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    onboardingComplete: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IStudent>('Student', StudentSchema);
