import express from 'express';
import {
  getLeads,
  getLead,
  lookupLeadPhone,
  createLead,
  updateLead,
  deleteLead,
  addFollowUp,
  updateLeadStage,
  getBDMs,
  getLeadBdmNames,
  getLeadStageCounts,
  importLeads,
  getLeadStats,
  assignLeads,
  getFollowUpLeads
} from '../controllers/leads.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

// Lead CRUD routes
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
