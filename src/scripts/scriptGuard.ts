// Safety gate for the one-off maintenance scripts in src/scripts. They read MONGODB_URI from the
// same .env the deployed API uses, so running one by accident would write to the real database.
// Every script calls assertScriptSafe() right before it connects. Nothing here connects to a
// database, and the connection string is never printed.

import { isLocalMongoUri } from '../shared/utils/mongoUri';

// Shared with the API's startup database guard; re-exported so existing imports keep working.
export { isLocalMongoUri };

export const CONFIRM_PRODUCTION_FLAG = '--confirm-production';

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
