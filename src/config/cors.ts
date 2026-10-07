import { CorsOptions } from 'cors';
import { config } from './env';
import { isAllowedOrigin } from '../shared/utils/origin';

// One origin policy for both the REST API and Socket.IO. Unlisted localhost origins are trusted
// outside production only.
const originAllowed = (origin: string | undefined): boolean =>
  isAllowedOrigin(origin, config.cors.origins, config.cors.frontendUrl, !config.isProduction);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/server-to-server requests, local dev, and approved hosting origins.
    if (originAllowed(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    const corsError: Error & { status?: number } = new Error('Not allowed by CORS');
    corsError.status = 403;
    callback(corsError);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
};

/** Socket.IO origin check: same allow-list as REST, but rejects with a plain error. */
export const socketOriginCheck = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
  if (originAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
};
