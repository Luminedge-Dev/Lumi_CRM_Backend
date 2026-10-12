import mongoose from 'mongoose';
import { isLocalMongoUri } from '../shared/utils/mongoUri';
import { config } from './env';

/** Host part of a connection string, for logs: never the credentials, database name or options. */
const describeTarget = (uri: string): string =>
  /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri)?.[1] ?? 'configured database';

export interface DatabaseTargetCheck {
  allowed: boolean;
  reason: string;
}

/** Where the process runs (see config.deployment). Variable names only, never values. */
export interface RuntimeEvidence {
  platform: string;
  /** Hosting-runtime markers set by the real environment (RENDER, VERCEL, ...). */
  markers: string[];
  /** Which of NODE_ENV / MONGODB_URI a local .env file supplied. */
  envFileVars: string[];
}

/**
 * Startup safety gate; fails closed and its reason never contains the URI.
 *
 * Outside production the API only connects to a loopback MongoDB: missing, remote, mongodb+srv
 * and unparseable URIs are refused, unless ALLOW_REMOTE_DATABASE=true explicitly opts in to a
 * remote one. The opt-in never affects production mode.
 *
 * NODE_ENV=production alone is not trusted, because a local process can set it. Production mode is
 * accepted only for a real Vercel/Render runtime: NODE_ENV and MONGODB_URI come from the platform
 * (deployments never ship a .env file), the OS is Linux, and a hosting marker is present. Once
 * accepted, behaviour is unchanged (MONGODB_URI is required, see config.database.uri).
 */
export const evaluateDatabaseTarget = ({
  uri,
  isProduction,
  runtime,
  allowRemoteDev = false,
}: {
  uri: string | undefined;
  isProduction: boolean;
  runtime: RuntimeEvidence;
  /** ALLOW_REMOTE_DATABASE=true: a deliberate opt-in to a remote MongoDB outside production. */
  allowRemoteDev?: boolean;
}): DatabaseTargetCheck => {
  if (isProduction) {
    if (runtime.envFileVars.length > 0) {
      return {
        allowed: false,
        reason: `${runtime.envFileVars.join(' and ')} came from a local .env file, which deployments never use; a local process must not run in production mode`,
      };
    }
    if (runtime.platform !== 'linux') {
      return {
        allowed: false,
        reason: `NODE_ENV is production on ${runtime.platform}, but Vercel and Render run Linux; a local process must not run in production mode`,
      };
    }
    if (runtime.markers.length === 0) {
      return {
        allowed: false,
        reason: 'NODE_ENV is production but no Vercel or Render runtime was detected (none of RENDER, VERCEL, VERCEL_ENV, VERCEL_REGION, VERCEL_URL, AWS_LAMBDA_FUNCTION_NAME is set)',
      };
    }
    return { allowed: true, reason: `production deployment (${runtime.markers.join(', ')})` };
  }
  if (!uri || !uri.trim()) {
    return { allowed: false, reason: 'MONGODB_URI is not set; outside production it must name a local MongoDB (localhost, 127.0.0.1 or ::1)' };
  }
  if (!isLocalMongoUri(uri)) {
    if (allowRemoteDev && /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?[^/?]+/i.test(uri.trim())) {
      return { allowed: true, reason: 'remote database explicitly allowed by ALLOW_REMOTE_DATABASE' };
    }
    return {
      allowed: false,
      reason: 'MONGODB_URI is not a local MongoDB (remote host, mongodb+srv or unparseable); outside production only localhost, 127.0.0.1 or ::1 is allowed',
    };
  }
  return { allowed: true, reason: 'local database' };
};

const connectDB = async (): Promise<void> => {
  try {
    const { platform, markers, envFileVars } = config.deployment;
    const target = evaluateDatabaseTarget({
      uri: config.database.configuredUri,
      isProduction: config.isProduction,
      runtime: { platform, markers, envFileVars },
      allowRemoteDev: config.database.allowRemoteInDev,
    });
    if (!target.allowed) {
      throw new Error(`Refusing to connect to MongoDB: ${target.reason} (NODE_ENV=${config.nodeEnv || 'unset'})`);
    }
    if (!config.isProduction && !isLocalMongoUri(config.database.configuredUri)) {
      console.warn('WARNING: ALLOW_REMOTE_DATABASE is set; this non-production process is using a remote MongoDB.');
    }

    const mongoURI = config.database.uri;

    console.log(`Connecting to MongoDB host: ${describeTarget(mongoURI)}`);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      family: 4, // Force IPv4
    });

    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

/** True when Mongoose holds an open connection. */
export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
};

export default connectDB;
