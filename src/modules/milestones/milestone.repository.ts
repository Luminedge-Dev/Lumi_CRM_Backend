import Milestone, { MILESTONE_TEMPLATES } from '../../models/Milestone';

export const milestoneRepository = {
  /** The default checklist titles for a service type (falls back to Study Abroad). */
  templatesFor: (serviceType: string): string[] =>
    (MILESTONE_TEMPLATES as Record<string, string[]>)[serviceType] || (MILESTONE_TEMPLATES as Record<string, string[]>)['Study Abroad'],

  countByApplication: (applicationId: unknown) => Milestone.countDocuments({ applicationId }),

  insertMany: (milestones: Record<string, any>[]) => Milestone.insertMany(milestones),

  listForStudent: (studentId: unknown) => Milestone.find({ studentId }).sort({ order: 1 }),

  update: (id: string, update: Record<string, any>) => Milestone.findByIdAndUpdate(id, update, { new: true }),
};
