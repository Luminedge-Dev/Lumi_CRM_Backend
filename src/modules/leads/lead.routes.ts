import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import {
  addFollowUp,
  assignLeads,
  createLead,
  deleteLead,
  getBDMs,
  getFollowUpLeads,
  getLead,
  getLeadBdmNames,
  getLeads,
  getLeadStageCounts,
  getLeadStats,
  importLeads,
  lookupLeadPhone,
  updateLead,
  updateLeadStage,
} from './lead.controller';

// Mounted at /api/leads. Static paths are declared before '/:id' so they are never read as an id.
const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'bdm'), getLeads);
router.get('/stats', authenticateToken, authorizeRoles('admin', 'bdm'), getLeadStats);
router.get('/phone-lookup', authenticateToken, authorizeRoles('admin', 'bdm'), lookupLeadPhone);
router.get('/bdms', authenticateToken, authorizeRoles('admin', 'bdm'), getBDMs);
router.get('/bdm-names', authenticateToken, authorizeRoles('admin', 'bdm'), getLeadBdmNames);
router.get('/stage-counts', authenticateToken, authorizeRoles('admin', 'bdm'), getLeadStageCounts);
router.get('/follow-ups', authenticateToken, authorizeRoles('admin', 'bdm'), getFollowUpLeads);
router.get('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), getLead);
router.post('/', authenticateToken, authorizeRoles('admin', 'bdm'), createLead);
router.post('/import', authenticateToken, authorizeRoles('admin'), importLeads);
router.post('/assign', authenticateToken, authorizeRoles('admin'), assignLeads);
router.patch('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), updateLead);
router.patch('/:id/stage', authenticateToken, authorizeRoles('admin', 'bdm'), updateLeadStage);
router.patch('/:id/follow-up', authenticateToken, authorizeRoles('admin', 'bdm'), addFollowUp);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteLead);

export default router;
