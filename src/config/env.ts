import dotenv from 'dotenv';

// Names already set by the real environment (hosting platform, shell, test setup) before
// backend/.env.production.local is read. Lets the startup database guard tell platform-provided
// values from ones a local file filled in.
const PRESET_ENV_NAMES = new Set(Object.keys(process.env));

// Loads backend/.env.production.local, the single local config file (dotenv never overrides a
// variable that is already set, so NODE_ENV set at the shell - see package.json's "dev" script -
// test setup, and the hosting platform's real environment always win over whatever this file says).
const ENV_FILE_VALUES: Record<string, string> = dotenv.config({ path: '.env.production.local' }).parsed ?? {};

/** True when the variable's current value was filled in from a local .env file, not the real environment. */
const fromEnvFile = (name: string): boolean =>
  !PRESET_ENV_NAMES.has(name) && ENV_FILE_VALUES[name] !== undefined && process.env[name] === ENV_FILE_VALUES[name];

const nonEmpty = (value: string): boolean => value.trim() !== '';

// Variables only a hosting runtime sets. Render documents RENDER as always "true". Vercel exposes its
// system variables when the project allows it, and its functions run on AWS Lambda, which sets
// AWS_LAMBDA_FUNCTION_NAME; several are accepted so one disabled setting cannot break a deployment.
const DEPLOYMENT_MARKERS: ReadonlyArray<[name: string, matches: (value: string) => boolean]> = [
  ['RENDER', (v) => v === 'true'],
  ['VERCEL', (v) => v === '1'],
  ['VERCEL_ENV', nonEmpty],
  ['VERCEL_REGION', nonEmpty],
  ['VERCEL_URL', nonEmpty],
  ['AWS_LAMBDA_FUNCTION_NAME', nonEmpty],
];

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
    /** MONGODB_URI exactly as configured (undefined when unset/empty): no fallback. Read by the startup guard. */
    get configuredUri(): string | undefined {
      return str('MONGODB_URI');
    },
    /** ALLOW_REMOTE_DATABASE=true lets a non-production process use a remote MONGODB_URI (e.g. Atlas). */
    get allowRemoteInDev(): boolean {
      return process.env.ALLOW_REMOTE_DATABASE === 'true';
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

  schedules: {
    /** Bearer token for luminedge-server's own `/admin/get-schedules` (a separate system; its own staff-role JWT). */
    get luminedgeToken(): string | undefined {
      return str('LUMINEDGE_SCHEDULES_TOKEN');
    },
  },

  get renderExternalUrl(): string | undefined {
    return str('RENDER_EXTERNAL_URL');
  },

  /** Evidence about where this process runs, for the startup database guard. Names only, never values. */
  deployment: {
    /** Vercel and Render run Linux; a Windows or macOS process is a local one. */
    get platform(): string {
      return process.platform;
    },
    /** Hosting-runtime markers present in the real environment (a marker read from a .env file does not count). */
    get markers(): string[] {
      return DEPLOYMENT_MARKERS.filter(([name, matches]) => {
        const value = process.env[name];
        return value !== undefined && matches(value) && !fromEnvFile(name);
      }).map(([name]) => name);
    },
    /** Which of NODE_ENV / MONGODB_URI came from a local .env file (deployed runtimes never ship one). */
    get envFileVars(): string[] {
      return ['NODE_ENV', 'MONGODB_URI'].filter(fromEnvFile);
    },
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
  ['LUMINEDGE_SCHEDULES_TOKEN', 'exam slots fall back to our own DB-backed mock test schedules'],
];

/** Logs a warning (the name, never a value) per missing production variable. A no-op outside production. */
export const warnMissingProductionConfig = (): void => {
  if (!config.isProduction) return;
  for (const [name, effect] of RECOMMENDED_PRODUCTION_VARS) {
    if (str(name) === undefined) console.warn(`[config] ${name} is not set: ${effect}.`);
  }
};
