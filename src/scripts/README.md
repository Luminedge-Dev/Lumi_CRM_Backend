# Maintenance scripts

One-off tools, **not part of the running API** (nothing in `app.ts`/`server.ts` imports them, and
`tsconfig` compiles them only so they type-check). They read `MONGODB_URI` from `backend/.env`,
which is the same file the deployed API uses, so an unguarded run would hit the real database.

## Safety gate

Every script calls `assertScriptSafe()` (see `scriptGuard.ts`) right before it connects.

| Run type | Allowed when |
| --- | --- |
| Read-only dry run | always |
| Writing run with `NODE_ENV=production` | **never**. `--confirm-production` cannot override this |
| Writing run, `NODE_ENV` not `production` | the target is a loopback database, or `--confirm-production` is on the command line |

The loopback allowlist is exactly `localhost`, `127.0.0.1` and `::1`. `0.0.0.0` is **not** local, and
neither are private-network addresses such as `192.168.x.x` or `10.x.x.x`. A bracketed IPv6 host
(`mongodb://[::1]:27017/db`) is normalised to `::1` before the check. `mongodb+srv://` hosts are
never local. An unset or unparseable `MONGODB_URI` counts as "not local". The guard never prints the
connection string. `--confirm-production` is never a default and nothing in the repo passes it.

## Scripts

Run from `backend/` with `npx ts-node src/scripts/<name>.ts [flags]`.

| Script | What it does | Writes | Dry run | Destructive |
| --- | --- | --- | --- | --- |
| `backfillBdmName.ts` | fills `bdmName` on leads from a CSV | `leads` (bulk update) | yes, unless `--commit` | no |
| `importLeadsFromCsv.ts` | inserts leads from a CSV | `leads` (insert) | yes, unless `--commit` | no |
| `unassignRahulLeads.ts` | clears one BDM's lead assignments | `leads` (update) | yes, unless `--commit` | reversible only from a backup |
| `migrateLeadStageNames.ts` | renames legacy lead stage values | `leads` (update) | `--dry-run` | rewrites values in place |
| `migrateLegacyServiceInterest.ts` | normalises legacy `serviceInterest` values, writes a JSON backup to `migration-backups/` | `leads` (bulk update) | `--dry-run` | rewrites values in place |
| `seedCourses.ts` | default: upserts the default courses by `name` (`$setOnInsert`, existing courses untouched). `--reset --yes-delete-all-courses`: deletes every course, then inserts the default list | `courses` | no | no by default; **YES (`deleteMany`) only with both `--reset` and `--yes-delete-all-courses`** |
| `seedUsers.ts` | creates seed staff accounts (`SEED_*` env vars) | `users` | no | no |
| `seedLeads.ts` | creates sample leads | `leads` | no | no |
| `seedNotifications.ts` | creates sample notifications | `notifications` | no | no |
| `createUser.ts` | creates or updates one staff user (`SEED_*` env vars) | `users` | no | overwrites an existing user |
| `update_bdm_names.ts` | one-off rename of a BDM user | `users` | no | rewrites values in place |
| `update_lead_bdm_names.ts` | one-off rename of the BDM name on leads | `leads` | no | rewrites values in place |
| `fix_aroni_name.ts` | one-off fix of a single user's name | `users` | no | rewrites a value in place |

Scripts without a dry-run flag are all-or-nothing: they only run against a local database unless
you pass `--confirm-production`. Do not use that flag unless you have a verified backup and an
explicit decision to change a remote database. It never works when `NODE_ENV=production`.

`seedCourses.ts --reset` without `--yes-delete-all-courses` refuses before connecting. With both
flags it still goes through the safety gate, so production stays blocked.

## Removed scripts

- `resetPassword.ts` was deleted in the architecture refactor. It was a one-off that set a fixed,
  hard-coded password on one hard-coded staff account, with no guard and no dry run, and nothing
  referenced it. Supported replacements: the self-service `POST /api/auth/forget-password` +
  `/api/auth/reset-password` flow, or `createUser.ts` (guarded) for creating/overwriting a staff user.
  `git log --all -- '*resetPassword*'` shows the file in the initial commit (`backend/src/scripts/resetPassword.ts`),
  so its contents remain in git history. A stale compiled copy may also exist in ignored build output
  (`dist/`); `npm run build` now cleans `dist/` first. Rotate that account's password if it was ever in use.

## Not scripts

`migration-backups/` holds JSON snapshots written by migrations. It contains customer data and is
git-ignored; never commit it.
