import { Router } from 'express';
import {
  approveLeadEditRequest,
  createLeadEditRequest,
  getLeadEditRequests,
  rejectLeadEditRequest,
} from '../controllers/leadEditRequest.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.post('/leads/:leadId/edit-requests', authenticateToken, authorizeRoles('admin', 'bdm'), createLeadEditRequest);
router.get('/lead-edit-requests', authenticateToken, authorizeRoles('admin', 'bdm'), getLeadEditRequests);
router.patch('/lead-edit-requests/:requestId/approve', authenticateToken, authorizeRoles('admin'), approveLeadEditRequest);
router.patch('/lead-edit-requests/:requestId/reject', authenticateToken, authorizeRoles('admin'), rejectLeadEditRequest);

export default router;
