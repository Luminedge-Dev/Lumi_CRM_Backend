import { NextFunction, Request, RequestHandler, Response } from 'express';
import { isValidationError } from '../../shared/utils/mongooseErrors';
import { AppError } from '../errors';
import { ErrorShape, sendError } from './response';

export interface HandlerOptions {
  /** Error body shape this endpoint already uses (default `{ error }`). */
  shape?: ErrorShape;
  /** What an unexpected (non-AppError) failure returns. */
  fallbackMessage?: string;
  /** Status for an unexpected failure (existing contracts use 500 for reads and 400 for some writes). */
  fallbackStatus?: number;
  /** Server-side log label for unexpected failures. */
  logLabel?: string;
  /** When true, a Mongoose ValidationError is answered 400 with its (caller-input-only) message. */
  exposeValidation?: boolean;
  /** Status used for an exposed validation failure (default 400; one legacy endpoint answers 500). */
  validationStatus?: number;
}

/**
 * Wraps a controller so that:
 *  - an AppError becomes its own status + safe message in the endpoint's established body shape;
 *  - anything else is logged server-side and answered with the endpoint's fixed fallback message,
 *    never the raw error text.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>, opts: HandlerOptions = {}): RequestHandler =>
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const shape = opts.shape ?? 'error';
    try {
      await fn(req, res);
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof AppError) {
        sendError(res, shape, err.status, err.message, err.extra);
        return;
      }
      if (opts.exposeValidation && isValidationError(err)) {
        sendError(res, shape, opts.validationStatus ?? 400, err.message);
        return;
      }
      console.error(opts.logLabel ?? 'Unhandled controller error:', err);
      sendError(res, shape, opts.fallbackStatus ?? 500, opts.fallbackMessage ?? 'Internal server error');
    }
  };
