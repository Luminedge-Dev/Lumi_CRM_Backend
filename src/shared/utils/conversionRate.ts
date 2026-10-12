/** Percentage of `part` within `total`, one decimal place, as a string ('0' when `total` is 0). */
export const conversionRate = (part: number, total: number): string =>
  total > 0 ? ((part / total) * 100).toFixed(1) : '0';
