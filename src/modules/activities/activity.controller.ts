import { asyncHandler } from '../../core/http';
import { activityService } from './activity.service';

// `{ message }` on failure with a fixed message.
export const getActivities = asyncHandler(
  async (req, res) => {
    res.json(await activityService.getFeed({ date: req.query.date as string, type: req.query.type as string }));
  },
  { shape: 'message', fallbackMessage: 'Failed to fetch activities', logLabel: 'Error fetching activities:' },
);
