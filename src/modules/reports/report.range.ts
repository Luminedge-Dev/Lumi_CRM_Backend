// Date windows for the reports. Pure; boundaries use the server's local time zone, as they always have.

export function getDateRange(
  range: string,
  startDate?: string,
  endDate?: string,
  month?: number,
  year?: number,
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'specific_date': {
      const start = startDate ? new Date(startDate) : new Date(now);
      start.setHours(0, 0, 0, 0);
      const e = new Date(start);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'this_week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'monthly': {
      const m = month !== undefined ? month : now.getMonth();
      const y = year !== undefined ? year : now.getFullYear();
      const start = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { start, end };
    }
    case 'custom': {
      return {
        start: startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1),
        end: endDate ? new Date(endDate) : end,
      };
    }
    default: {
      // this_month
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
  }
}
