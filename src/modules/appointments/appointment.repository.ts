import Appointment from '../../models/Appointment';

export const appointmentRepository = {
  create: (data: Record<string, any>) => Appointment.create(data),

  listForStudent: (studentId: unknown) =>
    Appointment.find({ studentId }).populate('staffId', 'name role').sort({ scheduledAt: 1 }),

  listAll: (filter: Record<string, any>) =>
    Appointment.find(filter)
      .populate('studentId', 'name email')
      .populate('staffId', 'name role')
      .sort({ scheduledAt: 1 }),

  update: (id: string, updates: Record<string, unknown>) =>
    Appointment.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('studentId', 'name email')
      .populate('staffId', 'name role'),
};
