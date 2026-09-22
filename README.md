# mm-store-apps-orders

A store order-management service: orders move through a strict `OPEN → IN_PROGRESS → COMPLETE` state
machine, exposed through a GraphQL API, backed by MongoDB. Built as a take-home challenge for MediaMarkt.

**Live demo:** [orders-web](https://orders-web-whpt5b2l6a-ew.a.run.app) ·
[orders-api /graphql](https://orders-api-whpt5b2l6a-ew.a.run.app/graphql) (GraphiQL is on; try
[`docs/demo.graphql`](docs/demo.graphql))

## Context

The brief: an order-management API where an order's state can only move forward one step at a time
(`OPEN → IN_PROGRESS → COMPLETE`), never skip a step and never go back, and `IN_PROGRESS` requires an
assigned employee. It had to be Node.js/TypeScript, GraphQL, MongoDB, and use an IoC container of choice,
with queries to list orders and get details, and mutations to transition state — plus room to show how
wrong input and unusual behaviour (concurrent transitions, invalid data) are handled, and to explain every
non-obvious decision along the way.

## Problem

Three things make this more than CRUD:

1. **The state machine is the actual product requirement**, not an implementation detail — skip/revert
   attempts, and starting an order with no employee, have to be _visibly_ rejected, not silently ignored.
2. **Two clients racing to start the same order** must not both succeed — the usual read-modify-write
   pattern on a single MongoDB document has no free correctness guarantee.
3. **A one-person take-home** still has to demonstrate the shape of production judgement: functional
   modules, an explicit IoC container, tested error handling, and infra that a stranger can stand up.

## Solution

- **NestJS as the IoC container** (`@nestjs/core`'s DI) + `@nestjs/graphql` with Apollo Server, code-first.
  Each Nest module is one of this app's "functional modules"; the composition root (`AppModule` + each
  module's `providers`) is the only place concrete classes are bound to interfaces. See
  [ADR 0002](docs/adr/0002-nestjs-ioc.md) for the alternatives considered (Awilix, InversifyJS) and why
  Nest won.
- **The state machine is a pure domain function** (`src/modules/orders/domain`, zero framework imports,
  enforced by an ESLint rule), backed by an **atomic conditional update** in MongoDB
  (`updateMany({ where: { id, state: from, version } })`) so two concurrent "start" calls cannot both win —
  see [ADR 0005](docs/adr/0005-order-state-machine.md).
- **MongoDB via Prisma 6.19** (Prisma 7 dropped Mongo support; 8's Mongo support was still an RC when this
  was built — see the spike write-up in [ADR 0004](docs/adr/0004-persistence-prisma-mongodb.md)). One
  order is one document (customer, line items and the employee snapshot embedded), which keeps every
  transition a single-document atomic write.
- **One generic `transitionOrder` mutation** rather than per-transition mutations (`startOrder`,
  `completeOrder`), so that "skip a step" is an expressible, rejectable request instead of something the
  schema simply has no way to say — see [ADR 0005](docs/adr/0005-order-state-machine.md) for the trade-off
  against schema-enforced required arguments.
- **A minimal React/Apollo frontend** (`apps/web`) exists to make the demo tangible; it isn't the part
  being assessed. See [ADR 0007](docs/adr/0007-minimal-web-client.md).
- **Deployed to GCP Cloud Run + MongoDB Atlas**, provisioned with Terraform, deployed by GitHub Actions on
  every merge to `main`. See [ADR 0008](docs/adr/0008-deploy-gcp-cloud-run-terraform.md).

Every decision above (and the ones not listed here) has a full ADR — Context, Decision, Alternatives,
Consequences — in the [ADR index](docs/adr/README.md).

## Outcome

All 16 planned tasks are shipped (see [`tasks/plan.md`](tasks/plan.md) for the full breakdown and
[`tasks/todo.md`](tasks/todo.md) for per-task acceptance criteria): the API, the state machine with its
concurrency guard, the web client, Docker images, and a live Terraform-provisioned deployment that redeploys
automatically on every merge to `main`. [`docs/AI_USAGE.md`](docs/AI_USAGE.md) is a running log, task by
task, of what was delegated to AI tooling, what was decided or checked by hand, and how each piece was
validated.

## Quick start

### Local (no Docker)

Requires Node ≥ 24 and Yarn (via Corepack, already pinned in `package.json`).

```bash
corepack enable
yarn install
docker compose up -d mongo          # a single-node replica set; Prisma on Mongo needs one
yarn workspace @app/api seed        # 18 employees + 80 demo orders, idempotent
yarn workspace @app/api dev         # http://localhost:3000/graphql (GraphiQL on by default)
yarn workspace @app/web dev         # http://localhost:5173
```

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env` to override
defaults (ports, `DATABASE_URL`, CORS). Every API env var is validated at boot — a bad value fails fast
with a readable error instead of misbehaving at runtime.

Try the API on its own with [`docs/demo.graphql`](docs/demo.graphql) in GraphiQL: health check → list
employees → create an order → start it → try to skip straight to COMPLETE from OPEN (rejected) → complete
it properly.

### Docker (full stack, one command)

```bash
docker compose up --build
```

Builds and runs `mongo` (single-node `rs0`), a one-shot `seed` job, `api` (`:3000`) and `web` (`:8080`) —
no local Node/Yarn needed. Override ports with `API_PORT`/`WEB_PORT`/`MONGO_PORT` if `3000`/`8080`/`27018`
are taken. `docker compose ps` should show `api` as `healthy`.

### Production

Already deployed — see the live links at the top. `docker compose up --build` is also the documented
fallback if Cloud Run or Atlas is unreachable during a live demo (see [`docs/deploy.md`](docs/deploy.md)).

### Tests

```bash
yarn test          # unit + integration (Vitest, MongoMemoryReplSet for integration)
yarn test:cov       # same, with coverage — 100% required on every modules/*/domain folder
yarn e2e            # Playwright, full stack (starts its own API + Mongo)
yarn typecheck && yarn lint
```

## Architecture

```
┌─────────────┐        GraphQL over HTTP        ┌──────────────────────────────────────────┐
│  apps/web   │ ───────────────────────────────▶│                 apps/api                  │
│ React+Apollo│                                  │  Apollo Server (@nestjs/graphql)          │
└─────────────┘                                  │  ┌──────────────────────────────────────┐ │
                                                  │  │ modules/orders                        │ │
                                                  │  │  graphql/  → application/ → domain/   │ │
                                                  │  │                    │         (pure)   │ │
                                                  │  │                    ▼                  │ │
                                                  │  │            infrastructure/ (Prisma)   │ │
                                                  │  └───────────────────┬────────────────────┘ │
                                                  │  ┌───────────────────▼────────────────────┐ │
                                                  │  │ modules/employees (exports EMPLOYEE_DIRECTORY only) │
                                                  │  └────────────────────────────────────────┘ │
                                                  │  core/  config · errors · logging · di · prisma │
                                                  └──────────────────────┬─────────────────────┘
                                                                         │ Prisma (replica set required)
                                                                         ▼
                                                                    MongoDB
                                                      (single-node rs0 locally / Docker, Atlas M0 in prod)
```

Each `modules/*` folder is a Nest module split into `domain/` (pure TypeScript, no framework or Prisma
imports — enforced by an ESLint `no-restricted-imports` rule), `application/` (use cases, depends on
interfaces via DI tokens, never concrete classes), `infrastructure/` (the Prisma adapter behind those
interfaces) and `graphql/` (types, inputs, resolvers). `OrdersModule` imports `EmployeesModule` and can
only inject what it explicitly exports (`EMPLOYEE_DIRECTORY`), never its repository — the module boundary
is enforced by the DI container itself, not just convention. See [ADR 0002](docs/adr/0002-nestjs-ioc.md)
and decision 2a in [`tasks/plan.md`](tasks/plan.md) for the full token/binding table.

## State machine

```
OPEN ──────▶ IN_PROGRESS ──────▶ COMPLETE
       (needs an employeeId)

Skipping (OPEN → COMPLETE), reverting (any step backward) and repeating a transition are all rejected.
```

`assertTransition` (`src/modules/orders/domain`) is a pure function over a lookup table
(`ORDER_TRANSITIONS: Record<OrderState, OrderState | null>`); the sequence rule is checked before the
employee rule. Once the domain accepts a transition, the repository applies it with a conditional update —
`updateMany({ where: { id, state: from, version } })` — so a losing concurrent request gets
`CONCURRENT_MODIFICATION` instead of silently overwriting the winner. Details, including the two ways a
race can be lost, are in [ADR 0005](docs/adr/0005-order-state-machine.md).

## Error catalog

Every GraphQL error carries a stable `extensions.code`, tested at least once each:

| Code                      | When                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `BAD_USER_INPUT`          | Input fails `class-validator` rules (shape/format, not business rules)  |
| `NOT_FOUND`               | Unknown order, employee or customer id                                  |
| `INVALID_TRANSITION`      | Skip, revert or repeat of a state transition                            |
| `EMPLOYEE_REQUIRED`       | `IN_PROGRESS` requested with no `employeeId`                            |
| `CONCURRENT_MODIFICATION` | Lost a race with another transition on the same order                   |
| `INTERNAL_SERVER_ERROR`   | Anything unexpected — masked and logged with a request id in production |

Unmasked GraphQL/Apollo codes (`GRAPHQL_VALIDATION_FAILED`, `GRAPHQL_PARSE_FAILED`, `BAD_REQUEST`) pass
through unchanged for requests that never reach a resolver. Full design, including why the mapping lives in
two layers of exception filters, in [ADR 0006](docs/adr/0006-error-handling-and-api-limits.md).

## Testing strategy

Pyramid-shaped, per [ADR](docs/adr/0004-persistence-prisma-mongodb.md) and
[`tasks/plan.md`](tasks/plan.md) decision 12:

- **Unit (Vitest):** the state machine, exhaustively over all 9 `from × to` pairs plus the employee rule;
  config validation; error mapping. **100% line/branch/function/statement coverage is enforced on every
  `modules/*/domain` folder** (`vitest.config.js`, checked in CI).
- **Integration (Vitest + SWC, `@nestjs/testing`):** every GraphQL operation through the real DI graph and
  `supertest` against `/graphql`, backed by `MongoMemoryReplSet` (Prisma needs a real replica set even in
  tests) — including a parallel-requests test that proves the concurrency guard, run repeatedly to catch
  flakiness.
- **Frontend (RTL):** component tests against a real Apollo `InMemoryCache`, not a mocked one, so pagination
  merge logic is actually exercised.
- **E2E (Playwright):** the full stack, built and run in production mode against its own database — a happy
  path (create → start → complete) and a rejected transition.
- **CI mirrors all of it** on every PR: lint, typecheck, unit+integration tests with coverage, build,
  Playwright E2E, a Docker build-and-healthcheck job, and `terraform fmt`/`validate` when `infra/**`
  changes. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deployment

GCP Cloud Run (`orders-api`, `orders-web`, scale-to-zero) + MongoDB Atlas M0, provisioned with Terraform
and deployed by GitHub Actions (Workload Identity Federation — no service-account keys) on every green
merge to `main`. Full pipeline, rollback and local-fallback instructions: [`docs/deploy.md`](docs/deploy.md).
Infra provisioning: [`infra/README.md`](infra/README.md). Why Cloud Run over GKE/App Engine, the cold-start
measurement (~0.6s), and two issues only a live `apply`/deploy could catch (Atlas's GCP region naming,
a missing Cloud Run service account): [ADR 0008](docs/adr/0008-deploy-gcp-cloud-run-terraform.md).

## Scaling notes

Out of scope for a demo, but worth being explicit about:

- **API replicas:** `OrdersService` and the Prisma repository are stateless; Cloud Run (or any platform)
  can run N instances behind a load balancer with no code change. `min-instances=1` is a one-flag switch
  if cold starts ever become a problem (currently ~0.6s, accepted for the demo).
- **MongoDB:** the existing `{ state: 1, _id: -1 }` index covers the list query's filter+sort. Beyond
  M0: read replicas for `orders`/`employees` reads, and if order volume grew far past a single replica
  set, `_id` (an `ObjectId`, roughly time-ordered) is a workable shard key for range/insert locality,
  though a synthetic key would avoid the classic monotonic-shard-key hotspot.
- **Events/outbox:** transitions are synchronous today. The `history` array on each order is already an
  event log in miniature; an outbox table plus a change-stream or CDC consumer would let other services
  (notifications, analytics, a picking system) react to transitions without polling.
- **Temporal (or similar):** deliberately not used — see [`tasks/plan.md`](tasks/plan.md) decision 11.
  It would earn its keep the moment a transition needs a timer (auto-escalate an order stuck in
  `IN_PROGRESS`), a multi-step saga (picking → payment → notification), or durable retries on a side
  effect. None of that exists yet; MongoDB stays the source of truth for order state either way.

## Trade-offs and next steps

Recorded as explicit **Out of Scope** in [`tasks/plan.md`](tasks/plan.md): no auth (assumed to sit behind
a gateway), no employee CRUD (seeded reference data only), no editable line items or order cancellation
(neither is in the state diagram), no employee reassignment. The Atlas network allowlist is `0.0.0.0/0`
for the demo, scoped to a single least-privilege DB user over TLS — a VPC connector would be the next step
for anything beyond a demo. Next, in priority order: authentication/authorization at the gateway, employee
CRUD, and the outbox/events path above once a second consumer of order transitions actually exists.

## Repository layout

```
apps/api/          NestJS + Apollo GraphQL API (the part being assessed)
apps/web/           Minimal React + Apollo client (demo only)
infra/terraform/    GCP + MongoDB Atlas infrastructure as code
docs/adr/           Architecture Decision Records (Context/Decision/Alternatives/Consequences)
docs/               Deploy guide, AI usage log, GraphQL demo script
tasks/               Implementation plan and per-task acceptance criteria (kept as planning evidence)
```
