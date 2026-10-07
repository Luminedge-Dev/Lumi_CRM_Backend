import { HandlerOptions } from '../../core/http';
import { asyncHandler } from '../../core/http';
import { appointmentService } from './appointment.service';
import { parseAppointmentRequest, parseAppointmentUpdate, parseStatusFilter } from './appointment.validation';

// `{ success: false, message }` on failure; a validation failure on create is a 500 with its text.
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'appointment controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const requestAppointment = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.request((req as any).studentId, parseAppointmentRequest(req.body));
  res.status(201).json({ success: true, appointment });
}, opts);

export const getMyAppointments = asyncHandler(async (req, res) => {
  res.json({ success: true, appointments: await appointmentService.listForStudent((req as any).studentId) });
}, opts);

export const getAllAppointments = asyncHandler(async (req, res) => {
  res.json({ success: true, appointments: await appointmentService.listAll(parseStatusFilter(req.query)) });
}, opts);

export const updateAppointment = asyncHandler(async (req, res) => {
  res.json({ success: true, appointment: await appointmentService.update(req.params.id, parseAppointmentUpdate(req.body)) });
}, opts);
