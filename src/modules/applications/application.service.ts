import { found } from '../../core/errors';
import { conversationRepository } from '../conversations/conversation.repository';
import { milestoneService } from '../milestones/milestone.service';
import { studentRepository } from '../students/student.repository';
import { userRepository } from '../users/user.repository';
import { applicationRepository } from './application.repository';

export const applicationService = {
  /** A student files a new application; it starts as 'Submitted' with the first history entry. */
  submit(studentId: string, input: Record<string, unknown>) {
    return applicationRepository.create({
      studentId,
      ...input,
      status: 'Submitted',
      stageHistory: [{ status: 'Submitted', changedBy: studentId, changedAt: new Date() }],
    });
  },

  listForStudent: (studentId: unknown) => applicationRepository.listForStudent(studentId),

  async listAll(filter: Record<string, any>, page: number, limit: number) {
    const applications = await applicationRepository.findPage(filter, (page - 1) * limit, limit);
    const total = await applicationRepository.count(filter);
    return { applications, total, page };
  },

  /**
   * Admin assigns a BDM: records it on the application and the student, creates the milestone
   * checklist the first time, and opens a student <-> BDM conversation.
   */
  async assignStaff(id: string, assignedBDM: any, adminId: string) {
    const app = found(await applicationRepository.findByIdWithStudentContact(id), 'Application not found');

    if (assignedBDM) app.assignedBDM = assignedBDM;

    app.stageHistory.push({ status: app.status, changedBy: adminId, changedAt: new Date(), note: 'Staff assigned' });
    await applicationRepository.save(app);

    await studentRepository.setAssignedBdm(app.studentId, assignedBDM);

    // Auto-create milestones if none exist for this application.
    await milestoneService.ensureChecklist(app, id);

    // Create a conversation between the student and the assigned BDM.
    const student = app.studentId as any;
    if (assignedBDM) {
      const bdm = await userRepository.findNameAndRoleById(assignedBDM);
      if (bdm) {
        const existing = await conversationRepository.findForParticipantsAndApplication(
          [String(student._id), String(assignedBDM)],
          app._id,
        );
        if (!existing) {
          await conversationRepository.create({
            participants: [
              { participantId: String(student._id), participantType: 'student', name: student.name, role: 'Student' },
              { participantId: String(assignedBDM), participantType: 'staff', name: bdm.name, role: bdm.role },
            ],
            applicationId: app._id,
            title: `${student.name} — ${bdm.name}`,
          });
        }
      }
    }

    return app;
  },

  async updateStatus(id: string, status: any, note: any, userId: string) {
    const app = found(await applicationRepository.findById(id), 'Application not found');

    app.status = status;
    app.stageHistory.push({ status, changedBy: userId, changedAt: new Date(), note });
    await applicationRepository.save(app);

    return app;
  },

  async getById(id: string) {
    return found(await applicationRepository.findByIdDetailed(id), 'Not found');
  },

  /** The applications assigned to this staff member. */
  listForStaff: (userId: unknown) => applicationRepository.listForBdm(userId),
};
