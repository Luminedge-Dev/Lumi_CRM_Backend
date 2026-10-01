import { Router } from 'express';
import {
  requestAppointment,
  getMyAppointments,
  getAllAppointments,
  updateAppointment,
} from '../controllers/appointment.controller';
import { studentAuthMiddleware } from '../middleware/studentAuth.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/student/appointments', studentAuthMiddleware, requestAppointment);
router.get('/student/appointments', studentAuthMiddleware, getMyAppointments);
router.get('/appointments', authMiddleware, getAllAppointments);
router.patch('/appointments/:id', authMiddleware, updateAppointment);

export default router;
