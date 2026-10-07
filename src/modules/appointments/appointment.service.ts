import { AppError, found } from '../../core/errors';
import { isInvalidInputError } from '../../shared/utils/mongooseErrors';
import { appointmentRepository } from './appointment.repository';

export const appointmentService = {
  request: (studentId: string, input: Record<string, unknown>) =>
    appointmentRepository.create({ studentId, ...input }),

  listForStudent: (studentId: unknown) => appointmentRepository.listForStudent(studentId),

  listAll: (filter: Record<string, any>) => appointmentRepository.listAll(filter),

  async update(id: string, updates: Record<string, unknown>) {
    let appt;
    try {
      appt = await appointmentRepository.update(id, updates);
    } catch (err) {
      // Bad ids and values are the caller's mistake, not a server failure.
      if (isInvalidInputError(err)) {
        throw AppError.badRequest('Invalid appointment data');
      }
      throw err;
    }
    return found(appt, 'Appointment not found');
  },
};
