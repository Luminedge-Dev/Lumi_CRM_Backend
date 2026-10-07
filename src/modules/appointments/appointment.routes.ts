import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { getAllAppointments, getMyAppointments, requestAppointment, updateAppointment } from './appointment.controller';

// Mounted at /api.
const router = Router();

router.post('/student/appointments', studentAuthMiddleware, requestAppointment);
router.get('/student/appointments', studentAuthMiddleware, getMyAppointments);
router.get('/appointments', authMiddleware, requireStaff, getAllAppointments);
router.patch('/appointments/:id', authMiddleware, requireStaff, updateAppointment);

export default router;
