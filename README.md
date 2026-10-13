# Luminedge CRM Backend

Express + TypeScript + MongoDB API for the Luminedge CRM. Deployed as serverless functions on
Vercel; see [Deployment](#deployment) for the realtime/cron caveat that comes with that.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer structure (route → middleware → controller →
service → repository → model) and the decisions behind it.

## Requirements

- Node.js >= 20
- A MongoDB database (local for development, Atlas in production)

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` — at minimum `MONGODB_URI` (a local `mongodb://localhost:27017/...` is required
outside production unless `ALLOW_REMOTE_DATABASE=true`) and `JWT_SECRET`. The rest of the file
documents what each variable controls and what breaks when it's missing.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | compile once, then run with nodemon, `NODE_ENV=development` |
| `npm run dev:watch` | same, but recompiles on change (`tsc -w`) |
| `npm run build` | clean `dist/`, compile with `tsc` |
| `npm start` | run the compiled `dist/server.js` (production, non-serverless) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest (unit, integration, security — in-memory MongoDB) |

Maintenance/one-off scripts (CSV imports, seed data, backfills) live in `src/scripts/`; see
[src/scripts/README.md](./src/scripts/README.md) for the list and their safety guards.

## Deployment

Two entry points share the same `src/app.ts`:

- **`api/index.ts`** — Vercel serverless entry. Exports the Express app only. Set the environment
  variables from `.env.example` in the Vercel project settings (not read from any committed file).
  `BLOB_READ_WRITE_TOKEN` must come from a Vercel Blob store connected to the project, or document
  uploads are refused in production.
- **`src/server.ts`** — Node/Render entry. Connects the database, starts Socket.IO, the follow-up
  reminder cron, and the HTTP listener.

**Known gap on Vercel-only deployments:** serverless functions can't hold a persistent Socket.IO
connection, and there's no always-on process for `node-cron` to fire in, so real-time chat/
notifications and the scheduled follow-up reminder don't run there. `src/integrations/socket/`
already has a split-deployment bridge for this (`SOCKET_SERVER_URL` / `SOCKET_SERVER_SECRET`): run
`src/server.ts` on a second, always-on host (e.g. Render) and point the Vercel deployment at it to
restore both features.

Also required for the API to reach MongoDB Atlas from Vercel: allow `0.0.0.0/0` (or Vercel's IP
ranges) under Atlas **Network Access**, since Vercel's outbound IPs aren't static.

## Frontend

`Lumi_CRM_Frontend/` is the companion Next.js app; its `.env.example` lists the API/socket URLs it
needs (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`).
