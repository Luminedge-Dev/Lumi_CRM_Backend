// Safety gate for the one-off maintenance scripts in src/scripts. They read MONGODB_URI from the
// same .env the deployed API uses, so running one by accident would write to the real database.
// Every script calls assertScriptSafe() right before it connects. Nothing here connects to a
// database, and the connection string is never printed.

export const CONFIRM_PRODUCTION_FLAG = '--confirm-production';

// Exactly the loopback hosts. 0.0.0.0 is deliberately absent (it is not a loopback address).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Host part of one URI host entry: drops the port and the brackets around an IPv6 literal ("[::1]:27017" -> "::1"). */
const normalizeHost = (entry: string): string => {
  const h = entry.trim().toLowerCase();
  const bracketed = /^\[([^\]]*)\](?::\d+)?$/.exec(h);
  return bracketed ? bracketed[1] : h.replace(/:\d+$/, '');
};

export interface ScriptSafetyInput {
  /** The connection string the script is about to use (may be undefined if the env var is unset). */
  uri: string | undefined;
  nodeEnv: string | undefined;
  argv: readonly string[];
  /** false for a dry run that only reads; reads are always allowed. */
  writes: boolean;
}

export interface ScriptSafetyResult {
  allowed: boolean;
  reason: string;
}

/** True only when every host in the URI is a loopback address. An unparseable URI counts as NOT local. */
export const isLocalMongoUri = (uri: string | undefined): boolean => {
  if (!uri) return false;
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri.trim());
  if (!match) return false;
  if (/^mongodb\+srv:/i.test(uri.trim())) return false; // SRV hosts are always remote clusters
  const hosts = match[1].split(',').map(normalizeHost);
  return hosts.length > 0 && hosts.every((h) => LOCAL_HOSTS.has(h));
};

export const evaluateScriptSafety = ({ uri, nodeEnv, argv, writes }: ScriptSafetyInput): ScriptSafetyResult => {
  if (!writes) return { allowed: true, reason: 'dry run: read-only' };
  // Checked first: no flag can override a production environment.
  if (nodeEnv === 'production') {
    return { allowed: false, reason: `NODE_ENV is production (${CONFIRM_PRODUCTION_FLAG} cannot override this)` };
  }
  if (argv.includes(CONFIRM_PRODUCTION_FLAG)) {
    return { allowed: true, reason: `${CONFIRM_PRODUCTION_FLAG} was passed explicitly` };
  }
  if (!isLocalMongoUri(uri)) {
    return { allowed: false, reason: 'the target database is not a local MongoDB (or MONGODB_URI is unset/unparseable)' };
  }
  return { allowed: true, reason: 'target is a local, non-production database' };
};

/** Call immediately before mongoose.connect(). Exits the process (code 1) when the run is not allowed. */
export const assertScriptSafe = (scriptName: string, opts: { uri: string | undefined; writes: boolean }): void => {
  const result = evaluateScriptSafety({ ...opts, nodeEnv: process.env.NODE_ENV, argv: process.argv });
  if (!result.allowed) {
    console.error(
      `[${scriptName}] REFUSED: this script writes to the database and ${result.reason}.\n` +
        `  Run it against a local database, use the script's dry-run mode, or (only when NODE_ENV is not production) ` +
        `pass ${CONFIRM_PRODUCTION_FLAG} if you really intend to modify a remote database.`,
    );
    process.exit(1);
  }
  if (opts.writes) console.log(`[${scriptName}] safety check passed: ${result.reason}`);
};
