import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../../config/env';

/** 404 for any route that no router handled. */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
};

/**
 * Last-resort error handler. Only a 4xx message (CORS rejection, malformed JSON, upload limits...)
 * is shown to the caller; a 5xx never exposes its message, and the stack trace appears only when
 * NODE_ENV is 'development'.
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  // Upload limit violations (file too large, unexpected field...) are the caller's mistake.
  const status = err instanceof multer.MulterError ? 400 : err.status || 500;

  if (status >= 500) {
    console.error('Error:', err);
  } else {
    // A caller mistake needs one line, not a stack. Never log the error object itself: a JSON
    // parse failure carries the raw request body (e.g. a password), and the query string may too.
    console.warn(`[${status}] ${req.method} ${req.path}: ${err.type || err.code || err.message}`);
  }
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : err.message || 'Internal server error',
    ...(config.isDevelopment && { stack: err.stack }),
  });
};
