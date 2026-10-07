import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import {
  approveLeadEditRequest,
  createLeadEditRequest,
  getLeadEditRequests,
  rejectLeadEditRequest,
} from './leadEditRequest.controller';

// Mounted at /api.
const router = Router();

router.post('/leads/:leadId/edit-requests', authenticateToken, authorizeRoles('admin', 'bdm'), createLeadEditRequest);
router.get('/lead-edit-requests', authenticateToken, authorizeRoles('admin', 'bdm'), getLeadEditRequests);
router.patch('/lead-edit-requests/:requestId/approve', authenticateToken, authorizeRoles('admin'), approveLeadEditRequest);
router.patch('/lead-edit-requests/:requestId/reject', authenticateToken, authorizeRoles('admin'), rejectLeadEditRequest);

export default router;
