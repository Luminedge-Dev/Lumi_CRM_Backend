// Render's free plan spins the service down after ~15 minutes without inbound
// HTTP traffic, which kills open sockets and DB connections and forces a slow
// cold start on the next request. Pinging our own health check keeps traffic
// flowing so the instance never goes idle.
//
// Only self-ping during business hours (10:00-22:00 Asia/Dhaka) so the free
// Render workspace's shared 750-hour/month instance pool isn't burned running
// this (and sibling free services) around the clock. Outside this window we
// simply stop pinging and let Render spin the instance down naturally.
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, safely under the 15-minute spin-down window
const ACTIVE_START_HOUR = 10;
const ACTIVE_END_HOUR = 22;
const TIMEZONE = 'Asia/Dhaka';

function isWithinActiveHours(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIMEZONE }).format(new Date())
  );
  return hour >= ACTIVE_START_HOUR && hour < ACTIVE_END_HOUR;
}

export function initKeepAlive(): void {
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (process.env.NODE_ENV !== 'production' || !selfUrl) return;

  setInterval(async () => {
    if (!isWithinActiveHours()) return;

    try {
      const res = await fetch(`${selfUrl}/api/health`);
      console.log(`[KeepAlive] Self-ping responded with status ${res.status}`);
    } catch (err) {
      console.error('[KeepAlive] Self-ping failed:', err);
    }
  }, PING_INTERVAL_MS);

  console.log(
    `[KeepAlive] Self-ping scheduled every ${PING_INTERVAL_MS / 60000} minutes to ${selfUrl}/api/health ` +
    `(active ${ACTIVE_START_HOUR}:00-${ACTIVE_END_HOUR}:00 ${TIMEZONE})`
  );
}
