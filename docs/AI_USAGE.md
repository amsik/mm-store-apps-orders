# AI Usage

Running log of how AI tooling was used, kept per task and expanded into a full write-up in T16.

Tooling: Claude Code with the agent-skills workflows (plan, build with test-driven development, review).
Every AI-written change goes through a PR, CI (lint, typecheck, tests, build) and my review before merge.

## Log

### T2 — API bootstrap

- **Delegated:** scaffolding the Nest modules, config validator, health resolver, integration test and ADR drafts.
- **Decided or checked by me:** Nest 12 over the planned 11 (checked on npm that the ecosystem supports it:
  `@nestjs/graphql` 14, `@nestjs/config` 12, `nestjs-pino` 5); Vitest + SWC instead of Jest.
- **Validation:** the config tests and the `health` integration test were written first and seen failing
  (RED) before the implementation; manual boot with invalid env to read the error message; `yarn dev` + `curl`.

### T3 — Persistence and integration test harness

- **Delegated:** the Prisma 8 spike, the Prisma schema, `PrismaService`, the Vitest replica-set harness, the compose file and the ADR draft.
- **Decided or checked by me:** pinned Prisma 6.19.3 after the spike showed Prisma 8 is still an RC with no
  `@prisma/client@8` published; lazy connection so the API reports `db: DOWN` instead of crashing; `mongo:8.2` in
  compose after `mongo:8.0` refused to start on Docker Desktop's kernel (SERVER-121912).
- **Validation:** the `DATABASE_URL` config tests and the `db: UP/DOWN` integration tests were written first and seen
  failing; manual run of the dev server against compose Mongo, stopping and restarting the container (UP → DOWN → UP);
  Vitest's `hanging-process` reporter showed no leaked handles.

### T4 — Order state machine

- **Delegated:** the domain module (`OrderState`, transition table, `assertTransition`, typed errors), its tests,
  the coverage and ESLint guards, and the ADR draft.
- **Decided or checked by me:** a const object instead of a TS `enum` so the type is interchangeable with Prisma's;
  the sequence is checked before the employee rule; employee existence stays out of the domain (needs I/O, handled in T8);
  required CI status checks added to `main` protection at Checkpoint A, after the checkpoint run showed they were missing.
- **Validation:** the spec was written first and seen failing (RED); all 9 `from × to` pairs are generated rather than
  hand-listed; the 100% domain coverage threshold and the no-framework-imports rule were each checked by deliberately
  breaking them (an uncovered function, a `@nestjs/common` import) and seeing `yarn test:cov` and `eslint` fail.

### T5 — Create order and get order details

- **Delegated:** the order read model, the repository port and its Prisma and in-memory adapters, the GraphQL types,
  inputs and resolver, the validation → `BAD_USER_INPUT` and `NotFoundError` → `NOT_FOUND` mapping, and the tests.
- **Decided or checked by me:** errors carry stable codes from day one (a `ValidationPipe` exception factory with
  per-field paths, plus a GraphQL exception filter for `NotFoundError`), and T9 builds the full catalog on top; the
  `Employee` type waits for T8 instead of shipping a field that is always `null`; a new ESLint rule stops
  `application/` from importing Prisma, adapters or the GraphQL layer.
- **Validation:** the service, input-validator and GraphQL integration specs were written first and seen failing (RED);
  the new lint rule was checked with a deliberate Prisma import in `application/`; a manual run of the built API
  against compose Mongo (create → get, unknown id, malformed id). That run hit a local Homebrew `mongod` holding
  `127.0.0.1:27017` first, and `MONGO_PORT=27018` got around it.

### T7 — Employees module and seed data

- **Delegated:** the employees module (port, Prisma adapter, service, `employees` query), the seed script and the tests.
- **Decided or checked by me:** `EmployeesModule` exports only the `EMPLOYEE_DIRECTORY` port (`useExisting` on the
  service), so orders can never reach the repository; the seed only inserts missing records by fixed id, so re-running it
  never duplicates data or resets orders moved during a demo; Node 24's type stripping runs the seed with no extra
  dependency (no `ts-node`/`tsx`); sample orders stay OPEN until T8 adds `history`; after review I asked for more data
  (18 employees, 80 orders), generated deterministically from fixed lists so every run yields the same ids and contents.
- **Validation:** the integration specs (the `employees` query, `getById` → `null`, the seed run twice, and a module-boundary
  test where injecting the repository or the service class from outside fails to compile the container) were written
  first and seen failing (RED); `yarn seed` run twice against compose Mongo left 18 employees and 80 orders.

### T8 — Transition orders through a GraphQL mutation

- **Delegated:** `OrdersService.transition`, the compare-and-set repository method (Prisma and in-memory), the
  `transitionOrder` mutation, `assignedEmployee` and `history` on `Order`, the orders error filter and the tests.
- **Decided or checked by me:** kept the planned `version` field although `state` alone would guard today's writes
  (it keeps the guard correct once orders can change without a transition); dropped the planned re-read on a missed
  update, since orders are never deleted; unknown employee → `NOT_FOUND`; `employeeId` ignored on COMPLETE.
- **Validation:** the service and GraphQL specs were written first and seen failing (RED); every rejected case asserts
  the stored document is unchanged; the race test was run 8 times, then checked by removing the `state`/`version`
  condition, which made both concurrent starts succeed and failed the test every time; a manual run of the built API
  against compose Mongo walked every path and surfaced that orders stored before `version` existed can never
  transition (documented in ADR 0005 with the reset steps).

### T9 — Error handling, request ids and API limits

- **Delegated:** the catch-all `AppErrorFilter`, the `formatError` backstop, `x-request-id` generation, the new config
  keys (`CORS_ORIGINS`, `GRAPHQL_INTROSPECTION`, `GRAPHQL_MAX_DEPTH`), wiring of the depth rule, body limit and CORS, and the tests.
- **Decided or checked by me:** `OrdersErrorFilter` stays in the orders feature instead of being folded into core, since
  core would have to import the orders domain (ADR 0006). An incoming `x-request-id` is reused only when it matches a safe
  pattern. Introspection and GraphiQL share one switch that defaults to off in production. graphql-armor was chosen over
  the unmaintained `graphql-depth-limit`.
- **Validation:** unit and integration specs were written first and seen failing (RED). The 413 test hung instead of
  failing, which exposed a real bug: Nest routes HTTP-level errors to the global `@Catch()` filter, which answered with a
  GraphQL error and never wrote a response. It is fixed by delegating non-GraphQL hosts to `BaseExceptionFilter`. The depth
  rule threw a 500 until it was set to report through the validation context. A manual run of the built API with
  `NODE_ENV=production` and an unreachable database checked a masked `INTERNAL_SERVER_ERROR`, the echoed request id, a log
  line with `requestId`, `req.id` and the Prisma stack, rejected introspection, and a 413 for a 150 kB body.

### T10 — Web scaffold and orders list

- **Delegated:** the Vite/React workspace, Apollo Client setup, codegen config, the orders list (state filter, "Load
  more", loading/error/empty states), the RTL tests and the CI drift check.
- **Decided or checked by me:** types are generated from the committed SDL and committed too, so a breaking schema change
  fails the web typecheck in the same PR (ADR 0007); the `orders` cache policy keys by `filter` only and appends pages on
  `after`; no router and no UI kit yet; the API URL is a build-time `VITE_API_URL`, relying on the API's CORS allow-list.
- **Validation:** the list and formatting tests were written first and seen failing (RED); the tests use the real
  `createCache()`, so the pagination merge is covered. Manual run in Chrome against the built API and compose Mongo:
  seeded orders listed, "Load more" went from 20 to 40 rows, the COMPLETE filter showed only complete orders, and with
  the API stopped the page showed "Could not load orders: Failed to fetch" with a Retry button instead of a blank page.

### T11 — Order details and state transitions

- **Delegated:** the details screen (customer, items, total, employee, history), the Start/Complete actions, the hash
  router and the RTL tests.
- **Decided or checked by me:** only the next valid action is rendered, but the server stays the authority: a rejected
  transition shows the server's message and refetches the order; hash routes instead of a router library (ADR 0007); the
  list switched to `cache-and-network` so it reflects transitions made on the details screen.
- **Validation:** the details and route specs were written first and seen failing (RED). Manual run in Chrome against the
  built API: a seeded order was started with an employee and updated in place; the order was then completed with `curl`
  behind the UI's back, and clicking Complete showed "COMPLETE is final" and switched the view to COMPLETE with no
  actions; the list showed the new state. Starting an order stored before T8 (no `version`) was rejected and the view
  stayed OPEN, which is the legacy-data case already documented in ADR 0005.

### T12 — Create-order form and E2E tests

- **Delegated:** the create-order form (customer, dynamic line items, live total), its validation and server-error
  mapping, the Playwright config and specs, and the CI E2E job.
- **Decided or checked by me:** client rules mirror the API's and use the same dotted field paths, so server
  `BAD_USER_INPUT` details land on the same inputs; the client email check is deliberately looser than the API's, which
  keeps the API the authority and gives the E2E a real server-side validation case; E2E runs the _built_ API in production
  mode against a separate database; locally it runs in the installed Chrome instead of downloading Chromium.
- **Validation:** the form logic and component specs were written first and seen failing (RED). The E2E specs passed
  against the full local stack; to prove the validation spec checks something, the server-error mapping was broken on
  purpose and the spec failed, then the code was restored.
