// Small, dependency-free request-input validators shared by controllers and services.

/** A 24-character hex string. Stricter than mongoose.isValidObjectId, which also accepts any 12-char string. */
export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/** Parses ?page and ?limit into safe positive integers (NaN, negatives and huge values are clamped). */
export const parsePagination = (
  query: { page?: unknown; limit?: unknown },
  { defaultLimit = 50, maxLimit = 100 }: PaginationOptions = {},
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, parseInt(String(query.page ?? ''), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query.limit ?? ''), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

/** Picks only the listed keys that are present (not undefined) — an explicit mass-assignment whitelist. */
export const pickFields = <T extends string>(source: unknown, fields: readonly T[]): Partial<Record<T, unknown>> => {
  const out: Partial<Record<T, unknown>> = {};
  if (!source || typeof source !== 'object') return out;
  const record = source as Record<string, unknown>;
  for (const field of fields) {
    if (record[field] !== undefined) out[field] = record[field];
  }
  return out;
};
