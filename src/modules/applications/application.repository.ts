import Application, { IApplication } from '../../models/Application';

// All database access for service applications. Queries are unchanged from the controller.
export const applicationRepository = {
  create: (data: Record<string, any>) => Application.create(data),

  listForStudent: (studentId: unknown) =>
    Application.find({ studentId }).populate('assignedBDM', 'name email role').sort({ createdAt: -1 }),

  /** Admin list, newest first, paged. */
  findPage: (filter: Record<string, any>, skip: number, limit: number) =>
    Application.find(filter)
      .populate('studentId', 'name email phone serviceCategory')
      .populate('assignedBDM', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

  count: (filter: Record<string, any>) => Application.countDocuments(filter),

  findById: (id: unknown) => Application.findById(id),

  /** For assignment: the student's name/email are needed to name the conversation. */
  findByIdWithStudentContact: (id: unknown) => Application.findById(id).populate('studentId', 'name email'),

  findByIdDetailed: (id: unknown) =>
    Application.findById(id)
      .populate('studentId', 'name email phone serviceCategory onboardingComplete')
      .populate('assignedBDM', 'name email role'),

  listForBdm: (userId: unknown) =>
    Application.find({ assignedBDM: userId }).populate('studentId', 'name email phone').sort({ createdAt: -1 }),

  /** True when this application exists AND belongs to this student. */
  existsForStudent: (applicationId: unknown, studentId: unknown) =>
    Application.exists({ _id: applicationId, studentId }),

  save: (app: IApplication) => app.save(),
};
