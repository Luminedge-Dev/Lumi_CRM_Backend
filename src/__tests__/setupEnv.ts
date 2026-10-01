// Runs before any test file (and before app.ts/auth.middleware.ts) is imported —
// auth.middleware.ts throws at module-load time if JWT_SECRET is unset.
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';
