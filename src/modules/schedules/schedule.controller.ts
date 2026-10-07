import { asyncHandler } from '../../core/http';
import { scheduleService } from './schedule.service';

// `{ success: false, message }` on failure; upstream status codes are passed through.
export const getAvailableSchedules = asyncHandler(
  async (_req, res) => {
    res.json(await scheduleService.getAvailable());
  },
  { shape: 'success', fallbackMessage: 'Luminedge API is currently unavailable', fallbackStatus: 503 },
);
