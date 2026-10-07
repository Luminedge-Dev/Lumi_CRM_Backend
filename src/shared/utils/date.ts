// Asia/Dhaka has a fixed UTC+6 offset with no DST, so day boundaries can be computed with
// plain arithmetic instead of a timezone library.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function getDhakaDayBounds(reference: Date = new Date()): { todayStart: Date; todayEnd: Date } {
  const dhakaNow = new Date(reference.getTime() + DHAKA_OFFSET_MS);
  const y = dhakaNow.getUTCFullYear();
  const m = dhakaNow.getUTCMonth();
  const d = dhakaNow.getUTCDate();

  return {
    todayStart: new Date(Date.UTC(y, m, d, 0, 0, 0) - DHAKA_OFFSET_MS),
    todayEnd: new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - DHAKA_OFFSET_MS),
  };
}
