// Client for the external Luminedge schedule feed (a separate deployment). Nothing here touches our database.
const LUMINEDGE_API_URL = 'https://luminedge-server.vercel.app/api/v1/admin/get-schedules';

export type ScheduleFeedResult = { ok: true; data: unknown } | { ok: false; status: number };

/** Throws when the feed is unreachable (network error); returns ok:false with the upstream status for an HTTP error. */
export const fetchLuminedgeSchedules = async (): Promise<ScheduleFeedResult> => {
  const response = await fetch(LUMINEDGE_API_URL);
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, data: await response.json() };
};
