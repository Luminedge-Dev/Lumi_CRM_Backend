import { Response } from 'express';

// The API has three established error body shapes and the frontend reads each from the endpoints
// that use it, so responses are NOT standardised: every controller picks the shape its endpoint
// already returns.
//   'error'   -> { error: string }
//   'message' -> { message: string }
//   'success' -> { success: false, message: string }
export type ErrorShape = 'error' | 'message' | 'success';

export const errorBody = (shape: ErrorShape, message: string, extra?: Record<string, unknown>): Record<string, unknown> => {
  const base = shape === 'error' ? { error: message } : shape === 'message' ? { message } : { success: false, message };
  return extra ? { ...base, ...extra } : base;
};

export const sendError = (
  res: Response,
  shape: ErrorShape,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): Response => res.status(status).json(errorBody(shape, message, extra));
