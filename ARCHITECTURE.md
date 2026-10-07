# Backend architecture

```
HTTP request
  -> Route          (path, method, middleware, controller: nothing else)
  -> Middleware     (authentication, role authorization, sanitising, rate limiting, uploads)
  -> Controller     (req -> parse -> service call -> res; no database, no business rules)
  -> Service        (business rules, orchestration, calls repositories and integrations)
  -> Repository     (the only place that queries Mongoose models)
  -> Model          (existing Mongoose schemas; unchanged, same collections and indexes)
  -> MongoDB
```

`tests/unit/architecture.test.ts` enforces these rules (it fails the build if a controller imports a
model, a service imports Express, `process.env` is read outside `config/`, there is a second SMTP
transport, or an import cycle appears).

## Layout

```
api/index.ts          Vercel entry: exports the Express app from src/app.ts
src/app.ts            builds the Express app (shared by Vercel and Render)
src/server.ts         Render/Node entry: connect DB, start sockets and jobs, listen
src/config/           env.ts (the only reader of process.env), database.ts, cors.ts
src/core/             AppError + error codes, asyncHandler / error-body helpers
src/middleware/       auth/ authorization/ security/ uploads/ error/ request/
src/modules/<name>/   <name>.routes | controller | service | repository | validation | types
src/models/           existing Mongoose models (not changed by the refactor)
src/integrations/     google/ mail/ socket/ storage/ schedules/ (external systems)
src/jobs/             followUpReminder.job.ts, keepAlive.job.ts (cron; started by server.ts only)
src/scripts/          one-off maintenance scripts (see scripts/README.md)
src/shared/           constants/ validators/ utils/ used by more than one module
src/tests/            unit/ integration/ security/ helpers/ (all use an in-memory MongoDB)
```

Modules: auth, users, leads, leadEditRequests, students, applications, appointments, documents,
milestones, conversations, messages, notifications, tasks, courses, exams, mockTests,
mockTestPackages, schedules, news, dashboard, reports, activities.

## Decisions worth knowing

- **Responses are not standardised.** The frontend reads three error shapes (`{ error }`,
  `{ message }`, `{ success: false, message }`); each controller keeps the shape its endpoint always
  had. `asyncHandler` takes the shape as an option. Unexpected errors are logged and answered with
  a fixed message; only an `AppError` (or a Mongoose validation message, where that was always the
  contract) reaches the client.
- **Validation lives in `<module>.validation.ts`** as parse functions that select the allowed
  fields (no mass assignment), check ids, and throw `AppError`. They run before the service, in the
  original order. They are not Express middleware.
- **Ownership rules are not invented.** Where the existing application defines ownership (an edit
  request is filed by the BDM the lead is assigned to; `/applications/my`), the service enforces it.
  Where it does not (BDM access to all leads/tasks/students), behaviour is unchanged and documented
  in the refactor report.
- **No path aliases.** Relative imports work identically under ts-node, Jest, `tsc` (Render) and
  `@vercel/node`; an alias would need extra runtime resolution in each.
- **Configuration keeps the existing variable names** (`ALLOWED_ORIGINS`, `SMTP_PASS`, ...) because
  they are set in the live Render/Vercel environments. See `.env.example`.
- **Mail** goes through `integrations/mail` only; **Google** token verification through
  `integrations/google`; **Socket.IO** transport through `integrations/socket`, which calls the
  same conversation/message services as REST.
- **Database contract is untouched.** No model, collection, field, index or connection string was
  changed by the refactor.
