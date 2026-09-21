# Task List — Store Apps Order Management

Conventions for every task:
- Branch `type/short-name`, PR title = Conventional Commit (it becomes the squash commit), and the PR body follows
  **Context → Problem → Solution → Outcome/Verification**.
- CI green (lint, typecheck, test, build) before merge. No `@ts-ignore`, skipped tests or lowered thresholds.
- ADR added in the same PR when the task introduces a decision.
- No attribution trailers or footers in commits or PRs: no `Co-Authored-By:`, `Signed-off-by:` for tools,
  "Generated with …" lines or similar. AI usage is documented in `AI_USAGE.md` only.

Commands (after T1): `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`, `yarn workspace @app/api test:int`.
Stack: NestJS 12 (IoC + modules; planned 11, see ADR 0002) · `@nestjs/graphql` + ApolloDriver (code-first) · Prisma + MongoDB · class-validator · nestjs-pino.

---

## Phase 1: Foundation

### T0: Repository bootstrap (direct to `main`, the only non-PR commit)
**Description:** `git init`, an initial `chore: initial commit` containing `README.md` (one-liner) + `.gitignore`,
create the public GitHub repo `amsik/mm-store-apps-orders`, push, and enable branch protection on `main` (require PR + status checks).
- [x] Repo exists on GitHub; `main` is protected (PR required, linear history, no force-push, admins included; required CI checks added in T1)
- [x] Verification: a direct push to `main` is rejected with GH006
**Dependencies:** None · **Scope:** XS

### T1: `chore: scaffold yarn monorepo with tooling and CI`
**Description:** Yarn 4 workspaces (`apps/api`, `apps/web` placeholder), shared strict `tsconfig.base.json`, ESLint (flat config,
typescript-eslint) + Prettier, Vitest, commitlint + husky, and a GitHub Actions workflow (install with cache → lint → typecheck →
test → build, plus a PR-title Conventional Commit check). `.nvmrc` (Node 24 LTS).

**Acceptance criteria:**
- [x] `yarn install && yarn lint && yarn typecheck && yarn test && yarn build` pass from a clean clone
- [x] A non-conventional commit message is rejected locally; a bad PR title fails CI
- [x] A commit message with a `Co-Authored-By:` trailer is rejected by commitlint; a PR body with `Co-Authored-By` / "Generated with" fails CI
- [x] CI runs on the PR and is green

**Verification:** CI run link on the PR; local clean-clone run.
**Dependencies:** T0 · **Files:** `package.json`, `.yarnrc.yml`, `tsconfig.base.json`, `eslint.config.js`, `.github/workflows/ci.yml`, `commitlint.config.js`, `apps/api/package.json`
**Scope:** M

### T2: `feat(api): bootstrap nestjs graphql api with config and health check`
**Description:** NestJS app (`AppModule`), `GraphQLModule.forRoot<ApolloDriverConfig>` (code-first, `autoSchemaFile: schema.gql` committed),
`ConfigModule` with a Zod `validate`, `nestjs-pino` logger, global `ValidationPipe`, `enableShutdownHooks()`, and a `HealthModule` with a
`health` query. IoC groundwork: `src/core/di/tokens.ts` with `APP_CONFIG` (`useFactory`, typed) and `CLOCK` (`SystemClock`). Decide the API test runner here (Vitest+SWC vs Jest) → Vitest + `unplugin-swc`. ADRs: monorepo, NestJS as IoC/framework (with alternatives), code-first schema.

**Acceptance criteria:**
- [x] `yarn workspace @app/api dev` starts; `{ health { status } }` returns `OK`
- [x] Missing or invalid env fails at boot with a readable message listing the offending keys (unit-tested)
- [x] `schema.gql` is generated and committed; CI fails if it's stale
- [x] Consumers inject `APP_CONFIG` (typed `AppConfig`), never `process.env`; an integration test overrides `APP_CONFIG` via `overrideProvider`

**Verification:** unit tests for the config validator; integration test boots `AppModule` via `@nestjs/testing` and queries `/graphql` with supertest.
**Dependencies:** T1 · **Files:** `apps/api/src/{main.ts,app.module.ts}`, `src/core/{config,logging}/*`, `src/modules/health/*`, `schema.gql`, `docs/adr/0001..0003`
**Scope:** M

### T3: `feat(api): add prisma mongodb persistence and integration test harness`
**Description:** **Spike first (≤1h):** Prisma 8 + Mongo against a single-node replica set. If it's blocked, pin 6.19 and record why.
→ Outcome: Prisma 8 is still an RC with no `@prisma/client@8`, so we pinned **6.19.3** (ADR 0004).
Add `docker-compose.yml` (mongo with `rs0` init + healthcheck), the Prisma schema (Order with embedded types, Employee), a
`PrismaService` (global `PrismaModule`, `onModuleInit`/`onModuleDestroy`), and `health` extended with a DB ping. Test harness:
`MongoMemoryReplSet` global setup + per-test DB reset + a `createTestApp()` helper (Nest `TestingModule` → `INestApplication`). ADR: persistence choice.

**Acceptance criteria:**
- [x] `docker compose up -d mongo && yarn workspace @app/api dev` → health reports `db: UP`
- [x] `yarn test:int` spins up an in-memory replset, runs, and tears down with no leaked handles
- [x] Health reports `db: DOWN` (not a crash) when Mongo is unreachable

**Verification:** integration tests for DB health up/down; CI green including integration tests.
**Dependencies:** T2 · **Files:** `docker-compose.yml`, `apps/api/prisma/schema.prisma`, `src/core/prisma/*`, `test/setup/*`, `docs/adr/0004`
**Scope:** M

### ✅ Checkpoint A — Foundation
- [x] Clean clone → install → compose up → dev server + health OK
- [x] CI green, protection working, 3 PRs merged with conventional titles (required status checks added to `main` protection at this checkpoint)
- [x] Review with the user before domain work

---

## Phase 2: Core domain + API

### T4: `feat(orders): implement order state machine domain`
**Description:** Pure module `orders/domain`: the `OrderState` enum, the `ORDER_TRANSITIONS` table, `nextState()`,
`assertTransition(order, target, employee?)`, and typed domain errors (`InvalidTransitionError`, `EmployeeRequiredError`).
No framework imports. ADR: state-machine design + transition API shape.

**Acceptance criteria:**
- [x] Exhaustive table-driven tests over all 9 `from × to` pairs: only `OPEN→IN_PROGRESS` and `IN_PROGRESS→COMPLETE` pass
- [x] Self-transition, skip (`OPEN→COMPLETE`) and revert (`COMPLETE→*`, `IN_PROGRESS→OPEN`) are rejected with an `InvalidTransitionError` carrying `from`/`to`
- [x] `OPEN→IN_PROGRESS` without an employee throws `EmployeeRequiredError`

**Verification:** `yarn workspace @app/api test orders/domain`; 100% coverage on the domain folder.
**Dependencies:** T1 (logically independent of DB) · **Files:** `src/modules/orders/domain/{order-state.ts,state-machine.ts,errors.ts}`, `*.spec.ts`, `docs/adr/0005`
**Scope:** S

### T5: `feat(orders): create order and get order details`
**Description:** Vertical slice: code-first types (`Order`, `Customer`, `LineItem`, `Employee`, `OrderState` registered enum, `DateTime` scalar),
`createOrder(input)` mutation (always created in `OPEN`, no employee), and the `order(id)` query. class-validator on input classes
(customer name/email, ≥1 line item, integer quantity > 0, integer `unitPriceCents` ≥ 0, max lengths). Repository interface +
`ORDER_REPOSITORY` token in application, Prisma implementation bound in `OrdersModule`. `createdAt`/`updatedAt` managed by Prisma.
→ Outcome: the `Employee` GraphQL type and `assignedEmployee` field were left for T8, when an order can first have one
(always `null` until then). `OrdersService` needs no `CLOCK` yet (Prisma sets the timestamps); T8 adds it for `history.at`.

**Acceptance criteria:**
- [x] `createOrder` returns an order in state `OPEN` with timestamps, customer and line items; `order(id)` returns the same
- [x] Invalid input (empty items, qty 0, negative price, bad email) → `BAD_USER_INPUT` with field details; nothing persisted
- [x] `order(id)` with an unknown or malformed id → `NOT_FOUND` / `BAD_USER_INPUT` (never a 500)
- [x] `OrdersService` depends only on the `ORDER_REPOSITORY` and `CLOCK` tokens (no Prisma import in application/domain); unit tests build it with `InMemoryOrderRepository` and no container

**Verification:** integration tests via the GraphQL layer against the memory replset; unit tests for the input validators and the `OrdersService` (with an in-memory fake repository).
**Dependencies:** T3 · **Files:** `orders/orders.module.ts`, `orders/graphql/{order.types.ts,order.inputs.ts,orders.resolver.ts}`, `orders/application/{orders.service.ts,order.repository.ts}`, `orders/infrastructure/prisma-order.repository.ts`, tests
**Scope:** M

### T6: `feat(orders): list orders with state filter and cursor pagination`
**Description:** `orders(filter: { state }, first = 20, after): OrderConnection { nodes, pageInfo { endCursor, hasNextPage } }`,
sorted newest first, `first` capped at 100, index `{ state: 1, _id: -1 }`.

**Acceptance criteria:**
- [ ] Filtering by state returns only matching orders; no filter returns all
- [ ] Paging through 25 orders with `first: 10` yields 10/10/5 with no duplicates or gaps, and `hasNextPage` is correct
- [ ] `first` ≤ 0 or > 100, or a malformed cursor → `BAD_USER_INPUT`

**Verification:** integration tests with seeded fixtures.
**Dependencies:** T5 · **Files:** `order.types.ts`, `order.inputs.ts`, `orders.resolver.ts`, `orders.service.ts`, `prisma-order.repository.ts`, `schema.prisma`, tests
**Scope:** S

### T7: `feat(employees): add employees module with seed data`
**Description:** `employees` module: `employees` query (for the UI picker) and `EmployeesService.getById` used by orders
(`EmployeesModule` exports the service; `OrdersModule` imports the module, never the repository). An idempotent seed script (`yarn seed`) with ~5 employees and sample orders.

**Acceptance criteria:**
- [ ] `employees` returns the seeded list; running the seed twice produces no duplicates
- [ ] `getById` for an unknown id returns `null` (orders decides the error)
- [ ] `EmployeesModule` exports only the `EMPLOYEE_DIRECTORY` binding; orders injects the token, never the employees repository

**Verification:** integration tests; manual `yarn seed` against compose Mongo.
**Dependencies:** T3 · **Files:** `modules/employees/**`, `prisma/seed.ts`, tests
**Scope:** S

### T8: `feat(orders): transition orders through graphql mutation`
**Description:** The core. `transitionOrder(input: { orderId, targetState, employeeId })` → `Order`. Service flow: load the order →
`assertTransition` → (for IN_PROGRESS) resolve the employee → atomic conditional update (`where: { id, state: from, version }`)
that sets state, embeds an `assignedEmployee` snapshot, pushes a `history` entry `{ from, to, at, employeeId }` and increments
`version`. On `count === 0`, re-read and map to `NOT_FOUND` / `INVALID_TRANSITION` / `CONCURRENT_MODIFICATION`. Expose `history` on `Order`.

**Acceptance criteria:**
- [ ] Happy path OPEN → IN_PROGRESS (with a valid employee) → COMPLETE; `updatedAt` advances, `history` has 2 entries, employee is kept on COMPLETE
- [ ] Rejected with the correct `extensions.code` and **no state change**: skip, revert, repeat, IN_PROGRESS without an employee, unknown employee, unknown order
- [ ] Two concurrent `IN_PROGRESS` transitions on the same order → exactly one succeeds, the other gets `CONCURRENT_MODIFICATION` or `INVALID_TRANSITION`

**Verification:** integration test suite for the mutation, including a `Promise.all` race test; DB state asserted after every rejected case.
**Dependencies:** T4, T5, T7 · **Files:** `order.types.ts`, `order.inputs.ts`, `orders.resolver.ts`, `orders.service.ts`, `prisma-order.repository.ts`, `schema.prisma`, tests
**Scope:** M

### T9: `feat(api): harden error handling, input limits and request logging`
**Description:** Central error mapping (Apollo `formatError` + a domain-error → `GraphQLError` mapper): domain/app errors → stable codes,
unknown → masked `INTERNAL_SERVER_ERROR` in production with a `requestId`. `requestId` via nestjs-pino `genReqId` (echoed in `x-request-id`),
query depth limit (`validationRules`), body size limit, CORS from config, introspection/playground toggled by config.

**Acceptance criteria:**
- [ ] A thrown unexpected error returns no stack or message in `NODE_ENV=production`, and the log contains it together with the `requestId`
- [ ] A query exceeding the max depth is rejected before execution
- [ ] Every error code in the catalog is covered by at least one test

**Verification:** integration tests for the error mapping and limits; manual check of log output.
**Dependencies:** T8 · **Files:** `src/core/errors/*`, `src/app.module.ts`, `src/core/logging/*`, tests
**Scope:** M

### ✅ Checkpoint B — API complete
- [ ] All requirement rows in plan.md "traceability" for the backend are green
- [ ] Demo script runnable in Apollo Sandbox (`docs/demo.graphql`): create → list → start → complete → illegal attempts
- [ ] API coverage ≥ 90% on domain/application
- [ ] Review with the user (also a good moment for a subagent code review + `/code-review`)

---

## Phase 3: Minimal frontend

### T10: `feat(web): scaffold web app with orders list`
**Description:** Vite + React + TS, Apollo Client, codegen from the committed `apps/api/schema.gql` (typed documents), orders list with a state filter
and a "load more" (cursor) button, with loading, error and empty states. CI extended to the web workspace.

**Acceptance criteria:**
- [ ] With the API running, the list shows the seeded orders; the filter works
- [ ] An API error is shown as a readable message, not a blank page
- [ ] Codegen drift fails CI

**Verification:** RTL test with `MockedProvider` for list states; manual in the browser.
**Dependencies:** T6 · **Files:** `apps/web/**` (vite config, `codegen.ts`, `src/App.tsx`, `src/orders/OrdersList.tsx`, `src/apollo.ts`)
**Scope:** M

### T11: `feat(web): order details with state transitions`
**Description:** Details view (customer, items, total, employee, history timeline). Only the *next valid* action is shown
("Start" with an employee picker, "Complete"). Server errors (e.g. a race) are displayed and the data refetched.

**Acceptance criteria:**
- [ ] Start requires picking an employee; after success the state and employee update without a reload
- [ ] COMPLETE orders show no actions
- [ ] A server-rejected transition shows the error message and the view reflects the true server state

**Verification:** RTL tests for action visibility per state; manual.
**Dependencies:** T8, T10 · **Scope:** M

### T12: `feat(web): create order form and e2e tests`
**Description:** A minimal create-order form (customer + dynamic line items) with client-side validation mirroring the server.
Playwright E2E against the full stack in CI (compose Mongo + seed + api + web preview).

**Acceptance criteria:**
- [ ] E2E: create order → appears in the list → start with an employee → complete → no actions left
- [ ] E2E: server-side validation error is shown in the form
- [ ] The E2E job runs in CI and is green

**Verification:** `yarn e2e` locally and in CI.
**Dependencies:** T11 · **Files:** `apps/web/src/orders/CreateOrderForm.tsx`, `e2e/*.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
**Scope:** M

### ✅ Checkpoint C — Full stack
- [ ] The whole demo flow works in the browser and through GraphQL directly
- [ ] CI: lint, typecheck, unit, integration, E2E all green

---

## Phase 4: Ship

### T13: `build: dockerize api and web with full-stack compose`
**Description:** Multi-stage Dockerfiles (non-root user, prod deps only, healthcheck). The API image includes the Prisma engines.
`docker compose up` → Mongo rs + seed + api + web. CI builds the images.

**Acceptance criteria:**
- [ ] From a clean clone, `docker compose up --build` gives a working app on documented ports
- [ ] Images build in CI; the API container reports healthy

**Verification:** clean-clone run; `docker compose ps` shows healthy.
**Dependencies:** T9, T12 · **Scope:** S

### T14: `feat(infra): provision gcp and atlas with terraform`
**Description:** `infra/terraform` (providers `google`, `mongodbatlas`, `random`; GCS backend). Resources: project APIs, Artifact Registry,
runtime SA (secret accessor) + deploy SA (least privilege), a WIF pool/provider restricted to `amsik/mm-store-apps-orders`, a Secret Manager
secret `DATABASE_URL`, Cloud Run `orders-api` + `orders-web` (min 0 / max 2, `ignore_changes` on image, public invoker), the Atlas project,
an M0 cluster on GCP in the same region, a DB user with a `random_password` and `readWrite` on one DB only, and IP access list `0.0.0.0/0`.
Outputs: service URLs, WIF provider name, deploy SA email. CI: `terraform fmt -check` + `validate`.
ADR: Terraform + GCP Cloud Run + cold start.

**Acceptance criteria:**
- [ ] `terraform apply` from scratch (after the one-time state bucket) creates everything; a second `plan` shows **no changes**
- [ ] `terraform fmt -check` and `validate` pass in CI
- [ ] The DB password never appears in the repo or in CI logs; the Cloud Run API reads it only via Secret Manager

**Verification:** apply + a clean re-plan; `gcloud run services list`; Atlas UI shows the cluster; `mongosh` connects with the secret value.
**Dependencies:** T13 · **Files:** `infra/terraform/{versions.tf,gcp.tf,atlas.tf,cloudrun.tf,wif.tf,variables.tf,outputs.tf}`, `infra/README.md`, `.github/workflows/ci.yml`, `docs/adr/00xx`
**Scope:** M

### T15: `ci: deploy to gcp cloud run on merge to main`
**Description:** GitHub Actions `deploy` job (on `main`, `needs: ci`): OIDC auth via WIF (IDs from Terraform outputs stored as repo variables) →
build and push both images tagged with the commit SHA → `gcloud run deploy --no-traffic` for api, then web (API URL baked into the build) →
smoke test the `health` query and one `orders` query against the revision URL → `update-traffic --to-latest`.

**Acceptance criteria:**
- [ ] The public web URL works end to end against Atlas (create → start → complete) after a cold start
- [ ] Deploy runs automatically after merge; a failing smoke test fails the pipeline and traffic stays on the previous revision
- [ ] No keys or secrets in the repo or GitHub secrets; `.env.example` documents every variable
- [ ] Cold-start time measured and written in the ADR

**Verification:** live demo run on the prod URL after scale-to-zero; CI deploy logs; `gcloud run revisions list`.
**Dependencies:** T14 · **Files:** `.github/workflows/deploy.yml`, `docs/deploy.md`
**Scope:** S

### T16: `docs: readme, architecture decisions and AI usage`
**Description:** The README uses Context → Problem → Solution → Outcome: quick start (local, docker, prod URL), architecture
diagram, module map, state machine, error catalog, testing strategy, scaling notes (horizontal API replicas are stateless,
indexes, read replicas, sharding key, outbox/events and where Temporal would fit), trade-offs and next steps. Add `docs/AI_USAGE.md`
and link the ADR index and the demo script.

**Acceptance criteria:**
- [ ] Someone new can run the app from the README alone (verified by following it in a fresh clone)
- [ ] Each ADR has Context/Decision/Alternatives/Consequences
- [ ] AI_USAGE covers tools, why, and how output was validated, with concrete examples from the PRs

**Dependencies:** all · **Scope:** S

### ✅ Checkpoint D — Submission ready
- [ ] Fresh clone → README steps → everything works (local + docker + Cloud Run)
- [ ] All PRs merged with conventional titles; CI green on `main`
- [ ] Rehearse the demo + answers: why this architecture, alternatives, trade-offs, scaling, AI usage
