import { found } from '../../core/errors';
import { leadRepository } from '../leads/lead.repository';
import { studentRepository } from './student.repository';
import { StudentProfileInput } from './student.types';

export const studentService = {
  /** The student's own account plus the sales lead filed under their email, if any. */
  async getProfile(studentId: unknown) {
    const student = found(await studentRepository.findPublicById(studentId), 'Student not found');

    let lead = null;
    if (student.linkedLeadId) {
      lead = await leadRepository.findForStudentById(student.linkedLeadId);
    }

    // Not linked yet: try to find the lead by email and remember the link.
    if (!lead) {
      lead = await leadRepository.findForStudentByEmail(student.email);

      if (lead && !student.linkedLeadId) {
        student.linkedLeadId = lead._id as any;
        await studentRepository.save(student);
      }
    }

    return { student, lead };
  },

  async updateProfile(studentId: unknown, { name, phone, address }: StudentProfileInput) {
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();

    return found(await studentRepository.updateProfile(studentId, updates), 'Student not found');
  },

  async submitOnboarding(studentId: unknown, data: Record<string, unknown>) {
    return found(await studentRepository.updateOnboarding(studentId, data), 'Student not found');
  },

  listStudents: () => studentRepository.listAll(),

  async getStudent(id: string) {
    return found(await studentRepository.findByIdWithBdm(id), 'Student not found');
  },
};
