import mongoose from 'mongoose';
import Student, { IStudent } from '../../models/Student';
import { SENSITIVE_AUTH_FIELDS_PROJECTION as PUBLIC_FIELDS } from '../../shared/utils/sensitiveFields';

// All database access for student accounts (the `students` collection).
export const studentRepository = {
  /** Minimal record the auth middleware needs on every request. */
  findAuthState: (id: unknown) => Student.findById(id).select('isActive').lean(),

  existsByEmail: (email: string) => Student.findOne({ email }).select('_id'),

  findByEmail: (email: string | undefined) => Student.findOne({ email }),

  findById: (id: unknown) => Student.findById(id),

  existsById: (id: unknown) => Student.exists({ _id: id }),

  findPublicById: (id: unknown) => Student.findById(id).select(PUBLIC_FIELDS),

  findByValidResetToken: (tokenHash: string) =>
    Student.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }),

  create: async (data: Partial<IStudent> & Record<string, any>) => {
    const student = new Student(data);
    await student.save();
    return student;
  },

  save: (student: IStudent) => student.save(),

  /** Remembers which lead belongs to this student account. */
  linkLead: async (student: IStudent, leadId: string) => {
    student.linkedLeadId = new mongoose.Types.ObjectId(leadId);
    await student.save();
  },

  updateProfile: (id: unknown, updates: Record<string, unknown>) =>
    Student.findByIdAndUpdate(id, updates, { new: true }).select(PUBLIC_FIELDS),

  updateOnboarding: (id: unknown, data: Record<string, unknown>) =>
    Student.findByIdAndUpdate(id, data, { new: true }).select(PUBLIC_FIELDS),

  /** Records which BDM looks after the student (set when an application is assigned). */
  setAssignedBdm: (id: unknown, assignedBDM: unknown) =>
    Student.findByIdAndUpdate(id, { ...(assignedBDM ? { assignedBDM } : {}) }),

  /** Staff list: newest first, assigned BDM resolved. */
  listAll: () => Student.find().select(PUBLIC_FIELDS).populate('assignedBDM', 'name role').sort({ createdAt: -1 }),

  findByIdWithBdm: (id: unknown) =>
    Student.findById(id).select(PUBLIC_FIELDS).populate('assignedBDM', 'name role email'),
};
