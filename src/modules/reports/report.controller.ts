import { asyncHandler } from '../../core/http';
import { reportService } from './report.service';

// `{ message }` on failure with fixed messages.

export const getBDMReport = asyncHandler(
  async (req, res) => {
    const { range, bdm, startDate, endDate, month, year } = req.query as Record<string, string | undefined>;
    res.json(await reportService.getBdmReport({ range, bdm, startDate, endDate, month, year }));
  },
  { shape: 'message', fallbackMessage: 'Failed to generate report', logLabel: 'Error generating BDM report:' },
);

export const getBDMTaskStatus = asyncHandler(
  async (req, res) => {
    const { bdmId, date } = req.query;
    res.json(await reportService.getBdmTaskStatus(bdmId, date as string | undefined));
  },
  { shape: 'message', fallbackMessage: 'Failed to fetch task status', logLabel: 'Error fetching BDM task status:' },
);
