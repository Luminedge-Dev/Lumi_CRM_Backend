import { AppError } from '../../core/errors';
import { fetchLuminedgeSchedules } from '../../integrations/schedules/luminedgeSchedules.client';

export const scheduleService = {
  /** Available exam schedules, proxied from the Luminedge feed. */
  async getAvailable() {
    let result;
    try {
      result = await fetchLuminedgeSchedules();
    } catch (error) {
      console.error('Error fetching schedules from Luminedge:', error);
      throw new AppError('Luminedge API is currently unavailable', 503);
    }

    // An upstream 4xx (e.g. the feed now demanding credentials) is OUR gateway failure, not the
    // caller's: relaying a 401/403 would read as "your session is invalid" to a signed-in user.
    if (!result.ok) {
      throw new AppError('Failed to fetch schedules from Luminedge API', result.status >= 500 ? result.status : 502);
    }
    return result.data;
  },
};
