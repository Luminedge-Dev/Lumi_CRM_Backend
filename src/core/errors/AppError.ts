import { ErrorCode, ErrorCodes } from './errorCodes';

/**
 * An error whose message is SAFE to show the caller: the throwing code chose the text and the
 * status. Anything that is not an AppError (driver errors, bugs, config errors) is treated as an
 * internal failure and never has its message sent to a client.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: ErrorCode | string = ErrorCodes.INTERNAL,
    /** Extra response fields the endpoint's existing contract already carries (e.g. `details`). */
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, extra?: Record<string, unknown>) {
    return new AppError(message, 400, ErrorCodes.BAD_REQUEST, extra);
  }
  static unauthorized(message: string) {
    return new AppError(message, 401, ErrorCodes.UNAUTHENTICATED);
  }
  static forbidden(message: string) {
    return new AppError(message, 403, ErrorCodes.FORBIDDEN);
  }
  static notFound(message: string) {
    return new AppError(message, 404, ErrorCodes.NOT_FOUND);
  }
  static conflict(message: string, extra?: Record<string, unknown>) {
    return new AppError(message, 409, ErrorCodes.CONFLICT, extra);
  }
}
