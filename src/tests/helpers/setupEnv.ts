// Runs before any test file (and before app.ts/auth.middleware.ts) is imported —
// auth.middleware.ts throws at module-load time if JWT_SECRET is unset.
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// SAFETY LOCK: app.ts calls dotenv.config(), which fills in any variable that is NOT already set
// from backend/.env (a production file). dotenv never overrides an existing variable, so pinning
// the dangerous ones here guarantees tests can never reach production infrastructure.
// Tests use mongodb-memory-server (see setupDb.ts); this URI exists only so nothing falls back
// to the production value, and it points at a closed local port.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/crm_test_never_connect';
process.env.SOCKET_SERVER_URL = '';
process.env.SOCKET_SERVER_SECRET = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.BLOB_READ_WRITE_TOKEN = '';
process.env.GOOGLE_CLIENT_ID = '';
