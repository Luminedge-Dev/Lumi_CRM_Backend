import dotenv from 'dotenv';

// Loads backend/.env (dotenv never overrides a variable that is already set, so the test setup and
// the hosting platform's real environment always win).
dotenv.config();

// Every runtime read of process.env goes through this object. Values are read lazily (getters)
// so tests and platforms that set variables after import keep working. Secret values are never
// logged from here. Variable NAMES are deliberately unchanged: they are set in the live
// Render/Vercel environments.

const str = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
};

const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];
const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

export const config = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? '';
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
  get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  },
  get port(): string | number {
    return process.env.PORT || 5000;
  },

  database: {
    /** Production must name its database explicitly; only non-production falls back to a local one. */
    get uri(): string {
      const uri = str('MONGODB_URI');
      if (uri) return uri;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      return 'mongodb://localhost:27017/crm_luminedge';
    },
  },

  jwt: {
    get secret(): string {
      const secret = str('JWT_SECRET');
      if (!secret) throw new Error('JWT_SECRET environment variable is not set');
      return secret;
    },
    expiresIn: '7d' as const,
  },

  google: {
    get clientId(): string | undefined {
      return str('GOOGLE_CLIENT_ID');
    },
  },

  cors: {
    get origins(): Set<string> {
      const raw = str('ALLOWED_ORIGINS');
      return new Set((raw ? raw.split(',') : DEV_ORIGINS).map(normalizeOrigin));
    },
    get frontendUrl(): string | undefined {
      return str('FRONTEND_URL')?.trim();
    },
  },

  smtp: {
    get host(): string | undefined {
      return str('SMTP_HOST');
    },
    get port(): number {
      return parseInt(process.env.SMTP_PORT || '587');
    },
    get secure(): boolean {
      return process.env.SMTP_SECURE === 'true';
    },
    get user(): string | undefined {
      return str('SMTP_USER');
    },
    get pass(): string | undefined {
      return str('SMTP_PASS');
    },
    get from(): string | undefined {
      return str('SMTP_FROM');
    },
  },

  socket: {
    /** Dedicated socket host the API forwards notifications to (serverless deployments). */
    get bridgeUrl(): string | undefined {
      return str('SOCKET_SERVER_URL')?.replace(/\/+$/, '');
    },
    get bridgeSecret(): string | undefined {
      return str('SOCKET_SERVER_SECRET');
    },
  },

  storage: {
    get blobToken(): string | undefined {
      return str('BLOB_READ_WRITE_TOKEN');
    },
  },

  get renderExternalUrl(): string | undefined {
    return str('RENDER_EXTERNAL_URL');
  },
};

/** Fail fast at startup (and on cold start in serverless) when a required secret is missing. */
export const assertRequiredConfig = (): void => {
  void config.jwt.secret;
};

// Not fatal (the API can serve its core features without them), but in production each missing
// one disables a feature: email links, email delivery, browser access, Google sign-in, uploads.
const RECOMMENDED_PRODUCTION_VARS: ReadonlyArray<[name: string, effect: string]> = [
  ['FRONTEND_URL', 'password reset/setup emails cannot be sent'],
  ['ALLOWED_ORIGINS', 'only FRONTEND_URL is accepted as a browser origin'],
  ['SMTP_HOST', 'no email can be delivered'],
  ['SMTP_FROM', 'emails are sent from the default sender address'],
  ['GOOGLE_CLIENT_ID', 'Google sign-in is refused'],
  ['BLOB_READ_WRITE_TOKEN', 'document uploads are refused'],
];

/** Logs a warning (the name, never a value) per missing production variable. A no-op outside production. */
export const warnMissingProductionConfig = (): void => {
  if (!config.isProduction) return;
  for (const [name, effect] of RECOMMENDED_PRODUCTION_VARS) {
    if (str(name) === undefined) console.warn(`[config] ${name} is not set: ${effect}.`);
  }
};
