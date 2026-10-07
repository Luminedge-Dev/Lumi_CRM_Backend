import { found } from '../../core/errors';
import { milestoneRepository } from './milestone.repository';

export const milestoneService = {
  /**
   * Creates the default milestone checklist for an application the first time it is needed
   * (the first step starts 'In Progress'); a no-op when milestones already exist.
   */
  async ensureChecklist(application: { _id: unknown; studentId: unknown; serviceType: string }, applicationId: string): Promise<void> {
    if ((await milestoneRepository.countByApplication(applicationId)) > 0) return;

    const milestones = milestoneRepository.templatesFor(application.serviceType).map((title: string, idx: number) => ({
      studentId: application.studentId,
      applicationId: application._id,
      serviceType: application.serviceType,
      title,
      order: idx + 1,
      status: idx === 0 ? 'In Progress' : 'Pending',
    }));
    await milestoneRepository.insertMany(milestones);
  },

  listForStudent: (studentId: unknown) => milestoneRepository.listForStudent(studentId),

  /** Staff update a milestone's status/notes; completing one stamps completedAt. */
  async update(id: string, input: { status: unknown; notes: unknown }, updatedBy: string) {
    const { status, notes } = input;

    const update: Record<string, any> = { status, updatedBy };
    if (notes !== undefined) update.notes = notes;
    if (status === 'Completed') update.completedAt = new Date();

    return found(await milestoneRepository.update(id, update), 'Milestone not found');
  },
};
