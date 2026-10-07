import { isValidationError } from './mongooseErrors';

/**
 * The only error text that may reach a client: Mongoose validation messages (they describe the
 * caller's own input, e.g. "Path `title` is required"). Every other error (driver errors,
 * duplicate-key details, config errors) becomes the stable fallback so internals never leak.
 * The real error must be logged server-side by the caller.
 */
export const publicErrorMessage = (err: unknown, fallback = 'Internal server error'): string =>
  isValidationError(err) ? err.message : fallback;
