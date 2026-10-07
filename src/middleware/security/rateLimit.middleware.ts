import rateLimit from 'express-rate-limit';

// Strict limiter for credential endpoints (login, registration, password reset).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter. The dashboard is polled frequently, so it is exempt.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/dashboard'),
});

// Account lookup used by the login screen. It reveals whether an email has an account, so it is
// limited, but more loosely than the credential endpoints because the login form calls it first.
export const accountLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sign-in endpoints without side effects: only FAILED attempts count, so brute force is capped
// while many people signing in successfully from one office IP are never locked out.
export const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: 'Too many failed sign-in attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** The credential endpoints guarded by authLimiter (every request counts). */
export const AUTH_LIMITED_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forget-password',
  '/api/auth/reset-password',
  '/api/auth/set-password',
  '/api/student/auth/register',
  '/api/student/auth/forgot-password',
  '/api/student/auth/reset-password',
];

/** Sign-in endpoints guarded by signInLimiter (failed attempts count). */
export const SIGN_IN_LIMITED_PATHS = ['/api/auth/google', '/api/student/auth/login', '/api/student/auth/google'];

/** Endpoints guarded by accountLookupLimiter. */
export const ACCOUNT_LOOKUP_PATHS = ['/api/auth/check-user'];
