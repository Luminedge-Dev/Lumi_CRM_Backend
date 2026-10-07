import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles, requireStaff } from '../../middleware/authorization/roles.middleware';
import {
  getAdminDashboardAll,
  getAdminStats,
  getBDMDashboardAll,
  getBDMRecentLeads,
  getBDMStats,
  getBDMUpcomingTasks,
  getConversionRateTrend,
  getLeadSourceDistribution,
  getLeadStageDistribution,
  getLeadStageTrend,
  getRecentActivity,
  getStatusDistribution,
  getTopPerformers,
} from './dashboard.controller';

// Mounted at /api/dashboard.
const router = Router();

// Disable HTTP caching for all dashboard routes so browsers always fetch fresh data
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// All routes require authentication
router.use(authenticateToken);
// Student tokens are also accepted by authenticateToken; the dashboard is staff-only.
router.use(requireStaff);

// BDM Dashboard Routes (accessible by all staff)
router.get('/bdm/stats', getBDMStats);
router.get('/bdm/recent-leads', getBDMRecentLeads);
router.get('/bdm/upcoming-tasks', getBDMUpcomingTasks);

// Shared Dashboard Routes
router.get('/lead-stage-distribution', getLeadStageDistribution);
router.get('/lead-stage-trend', getLeadStageTrend);
router.get('/lead-source-distribution', getLeadSourceDistribution);
router.get('/conversion-rate-trend', getConversionRateTrend);
router.get('/status-distribution', getStatusDistribution);

// Admin Dashboard Routes (admin only)
router.get('/admin/stats', authorizeRoles('admin'), getAdminStats);
router.get('/admin/recent-activity', authorizeRoles('admin'), getRecentActivity);
router.get('/admin/top-performers', authorizeRoles('admin'), getTopPerformers);

// Batch endpoints: a single request for the full dashboard
router.get('/bdm/all', getBDMDashboardAll);
router.get('/admin/all', authorizeRoles('admin'), getAdminDashboardAll);

export default router;
