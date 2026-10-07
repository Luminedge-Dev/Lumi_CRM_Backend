import { asyncHandler } from '../../core/http';
import { dashboardService } from './dashboard.service';

// `{ success: false, message }` on failure with fixed per-endpoint messages.
const opts = (fallbackMessage: string, logLabel: string) => ({ shape: 'success' as const, fallbackMessage, logLabel });

/** ?limit=N with a default; anything unparsable or zero falls back to the default. */
const limitFrom = (query: Record<string, unknown>, fallback: number): number => parseInt(query.limit as string) || fallback;

// ── BDM dashboard (data is global: all leads, same as admin) ──

export const getBDMStats = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getBdmStats() });
  },
  opts('Failed to fetch dashboard stats', 'Error fetching BDM stats:'),
);

export const getBDMRecentLeads = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await dashboardService.getBdmRecentLeads(limitFrom(req.query, 5)) });
  },
  opts('Failed to fetch recent leads', 'Error fetching recent leads:'),
);

export const getBDMUpcomingTasks = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await dashboardService.getBdmUpcomingTasks(limitFrom(req.query, 5)) });
  },
  opts('Failed to fetch upcoming tasks', 'Error fetching upcoming tasks:'),
);

// ── Shared chart endpoints ──

export const getLeadStageDistribution = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getLeadStageDistribution() });
  },
  opts('Failed to fetch lead stage distribution', 'Error fetching lead stage distribution:'),
);

export const getLeadStageTrend = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getLeadStageTrend() });
  },
  opts('Failed to fetch lead stage trend', 'Error fetching lead stage trend:'),
);

export const getLeadSourceDistribution = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getLeadSourceDistribution() });
  },
  opts('Failed to fetch lead source distribution', 'Error fetching lead source distribution:'),
);

export const getConversionRateTrend = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getConversionRateTrend() });
  },
  opts('Failed to fetch conversion rate trend', 'Error fetching conversion rate trend:'),
);

export const getStatusDistribution = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getStatusDistribution() });
  },
  opts('Failed to fetch status distribution', 'Error fetching status distribution:'),
);

// ── Admin dashboard ──

export const getAdminStats = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getAdminStats() });
  },
  opts('Failed to fetch admin stats', 'Error fetching admin stats:'),
);

export const getRecentActivity = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await dashboardService.getRecentActivity(limitFrom(req.query, 5)) });
  },
  opts('Failed to fetch recent activity', 'Error fetching recent activity:'),
);

export const getTopPerformers = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await dashboardService.getTopPerformers(limitFrom(req.query, 4)) });
  },
  opts('Failed to fetch top performers', 'Error fetching top performers:'),
);

// ── Batch endpoints (one request instead of eight) ──

export const getBDMDashboardAll = asyncHandler(
  async (req, res) => {
    const { version, data } = await dashboardService.getBdmDashboardAll(limitFrom(req.query, 5));
    res.json({ success: true, version, data });
  },
  opts('Failed to fetch BDM dashboard data', 'Error fetching BDM dashboard:'),
);

export const getAdminDashboardAll = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await dashboardService.getAdminDashboardAll(limitFrom(req.query, 5)) });
  },
  opts('Failed to fetch admin dashboard data', 'Error fetching admin dashboard:'),
);
