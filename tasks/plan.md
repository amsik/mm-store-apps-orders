# Implementation Plan: Store Apps — Order Management (GraphQL)

## Overview

A small order management service. It exposes a GraphQL API (Apollo Server) backed by MongoDB.
Each order moves through a strict linear state machine: `OPEN → IN_PROGRESS → COMPLETE`. Skipping a
state or going back is rejected, and an order in `IN_PROGRESS` must have an assigned employee.
The repo is a Yarn-workspaces monorepo with the backend (the part being assessed) and a deliberately
minimal React frontend for the live demo. Repo: `github.com/amsik/mm-store-apps-orders` (public). Every piece of work arrives as a PR titled with a
Conventional Commit, merged only when CI is green. The system is deployed at the end.

### Requirements traceability

| Requirement (challenge PDF / recruiter)                            | Where it is satisfied                     |
|--------------------------------------------------------------------|-------------------------------------------|
| Order: state, assigned employee, customer, line items, createdAt, updatedAt | T5 (Prisma model + GraphQL type)   |
| Strict sequence, no skip / no revert                               | T4 (pure state machine) + T8 (mutation)   |
| IN_PROGRESS requires an assigned employee                          | T4 (domain rule) + T8 (employee exists)   |
| Queries: list orders, order details                                | T5 (details), T6 (list)                   |
| Mutations for transitioning, **performed through GraphQL**         | T8                                        |
| Handles wrong input and unusual behaviour                          | T5–T9 (validation, error codes, races)    |
| Functional modules + configuration management                      | T2 (config, IoC), module layout           |
| NodeJS + TS, IoC container, MongoDB, GraphQL/Apollo                | T1–T3; IoC explicit per decision 2a (tokens in T5/T7/T8) |
| Bonus: CI pipeline                                                 | T1 (grows with every task)                |
| Bonus: every important aspect tested                               | per-task tests + T12 E2E                  |
| Runs locally for the demo                                          | T13 (`docker compose up`)                 |
| Explain decisions / AI usage (recruiter)                           | ADRs per task + T16 docs                  |

## Architecture Decisions

Each decision below gets a short ADR in `docs/adr/` (Context → Decision → Alternatives → Consequences),
written in the same PR that introduces it. ✅ = confirmed with the user on 2026-09-21.

1. **Monorepo: Yarn 4 (Berry) workspaces, `nodeLinker: node-modules`.** Layout: `apps/api`, `apps/web`.
   No shared package yet: the web app generates its types from the committed `apps/api/schema.gql` through codegen.
   Rationale: one repo gives one CI and atomic cross-stack PRs. Turborepo/Nx would be overkill for 2 apps.

2. **API composition ✅: NestJS 12 (planned 11; ESM-only, see ADR 0002) as the IoC container + `@nestjs/graphql` with `ApolloDriver` (Apollo Server 5 under the hood), code-first.**
   - Nest's DI container *is* the IoC choice, and Nest modules map directly onto "functional modules".
     The ADR must show we understand what Nest does for us: the module graph, providers, scopes and
     lifecycle hooks, and how the same thing would look with Awilix/Inversify + plain Apollo (the
     alternatives considered).
   - Code-first (TS classes + decorators generate the schema). One source of truth for types, and
     `autoSchemaFile` emits `schema.gql`, which is committed and used as the frontend codegen input
     and as a reviewable contract diff in PRs. Alternative: schema-first SDL + codegen (a better fit
     when the schema is designed separately or shared by several teams).
   - Repository abstraction via an injection token (`ORDER_REPOSITORY`), so the application layer depends on an interface, not Prisma.

2a. **IoC / Dependency Injection: explicit and demonstrable, not "hidden in Nest".**
   The IoC container is Nest's DI container (`@nestjs/core` injector). A requirement like this is easy to
   lose inside framework magic, so we make it visible in code and in docs:
   - **Composition root:** `AppModule` plus each feature module's `providers` array. That is the only place
     where concrete implementations are bound to abstractions. No `new` for services or repositories anywhere else.
   - **Abstractions bound to tokens** (`src/core/di/tokens.ts`), so consumers depend on interfaces, not classes:

     | Token | Interface (consumer side) | Binding (provider side) | Swapped in tests with |
     |---|---|---|---|
     | `ORDER_REPOSITORY` | `OrderRepository` (orders/application) | `PrismaOrderRepository` (`useClass`) | `InMemoryOrderRepository` for service unit tests |
     | `EMPLOYEE_DIRECTORY` | `EmployeeDirectory` (what orders needs from employees) | `EmployeesService` exported by `EmployeesModule` (`useExisting`) | stub directory |
     | `APP_CONFIG` | `AppConfig` (typed, validated) | `useFactory` over `ConfigService` + Zod | literal config object |
     | `CLOCK` | `Clock { now(): Date }` | `SystemClock` (`useValue`) | fixed clock → deterministic `history.at` |
     | `PrismaService` | (infrastructure only) | class provider with `onModuleInit`/`onModuleDestroy` lifecycle | memory replset URL via config |

   - **Module boundaries enforced by the container:** `OrdersModule` imports `EmployeesModule` and can only
     inject what it `exports` (the directory), never its repository. Cross-module coupling is therefore visible
     in the module graph.
   - **Scopes:** everything is singleton (default, stateless services). Request context (`requestId`) comes
     from nestjs-pino / AsyncLocalStorage, *not* request-scoped providers, because request scope would
     re-instantiate the whole dependency chain per request. This trade-off is recorded in the ADR.
   - **Proof in tests:** unit tests construct `OrdersService` with fakes and no container at all (DI by constructor). Integration
     tests boot the real graph and use `Test.createTestingModule(...).overrideProvider(CLOCK)` to show the binding is swappable.
   - **Alternatives in the ADR:** Awilix (explicit registration, no decorators), InversifyJS (decorators + container API),
     tsyringe, manual constructor wiring. Why Nest: DI + modules + lifecycle + first-class Apollo integration in one
     coherent, widely known framework, and the challenge explicitly allows "IoC container of your choice".

3. **Functional modules (Nest modules).** `src/modules/{orders,employees,health}`, each split into
   `domain/` (pure TS, **no Nest/Prisma imports**), `application/` (service/use cases), `infrastructure/` (Prisma repository),
   `graphql/` (object/input types + resolvers). Cross-cutting pieces live in `src/core/{config,prisma,errors,logging}`.
   This is lightweight hexagonal: the state machine is testable without `TestingModule` or mocks.

4. **Persistence: MongoDB + Prisma (v8 if the T3 spike passes, otherwise pin v6.19).** → **6.19.3 pinned** (spike: Prisma 8 is still an RC, see ADR 0004).
   - Prisma 7 dropped MongoDB, and support is back in Prisma 8 ([docs](https://www.prisma.io/docs/prisma-orm/quickstart/mongodb)).
     Because of that, T3 starts with a time-boxed spike. Fallback: v6.19, which is stable for Mongo.
   - Prisma on Mongo **requires a replica set**. We run a single-node `rs0` in docker-compose, use
     `MongoMemoryReplSet` in tests, and Atlas provides a replica set out of the box.
   - Embedded documents: `customer`, `lineItems[]`, `assignedEmployee` (snapshot `{id, name}`) and `history[]`
     all live inside the order document. An order is one aggregate, so one document per order gives
     atomic single-document updates with no multi-document transactions.
   - Alternative considered: Mongoose or the native driver (more idiomatic for Mongo, weaker typing).
     Prisma was chosen for its type-safe client and schema-as-code. Trade-off: no Mongo migrations
     (`db push` only for indexes).

5. **State machine = pure domain function + atomic compare-and-set in the DB.**
   - `ORDER_TRANSITIONS: Record<OrderState, OrderState | null>`, i.e. `OPEN→IN_PROGRESS→COMPLETE→null`.
     `assertTransition(order, target, employee?)` throws typed domain errors. The table mirrors the
     diagram one to one, so it is easy to review.
   - Race safety: `updateMany({ where: { id, state: from, version }, data: { state: to, version: {increment: 1}, history: {push} } })`.
     `count === 0` means we re-read the order to tell `NOT_FOUND`, `INVALID_TRANSITION` and
     `CONCURRENT_MODIFICATION` apart. Two parallel "start" calls therefore cannot both succeed.
   - Why no state-machine library (XState): 3 states and 2 edges. A lookup table is clearer and
     has zero dependencies.

6. **Transition API ✅: one generic mutation `transitionOrder(input: { orderId, targetState, employeeId })`.**
   - It maps literally onto the requirement ("mutations for transitioning" + "skipping/reverting not
     allowed"), and skip/revert attempts are expressible and visibly rejected, which is good for the demo.
   - The domain rejects `targetState: IN_PROGRESS` without an `employeeId`, and also an `employeeId`
     that does not exist.
   - Alternative: intent mutations `startOrder(orderId, employeeId!)` / `completeOrder(orderId)`. There
     the schema itself enforces the required employee, but "skip" cannot be expressed at all.
     Recorded in an ADR.

7. **Errors: GraphQL errors with stable `extensions.code`.** Codes: `BAD_USER_INPUT`, `NOT_FOUND`,
   `INVALID_TRANSITION`, `EMPLOYEE_REQUIRED`, `CONCURRENT_MODIFICATION`, `INTERNAL_SERVER_ERROR`.
   Unknown errors are masked in production and logged with a request id. Alternative: typed result
   unions (`TransitionResult = Order | InvalidTransition`), which are more explicit but cost the
   client extra boilerplate. Mentioned as an evolution path.

8. **Validation: global `ValidationPipe` + `class-validator` on GraphQL input classes** (Nest-idiomatic
   and co-located with code-first input types). Rules: ObjectId format (`@IsMongoId`), positive integer
   quantities, money in integer minor units, email, max lengths, `ArrayMinSize(1)`, `first` ≤ 100,
   `whitelist` + `forbidNonWhitelisted`. GraphQL types cover shape, the validators cover semantics,
   and the domain covers business rules.

9. **Config: `@nestjs/config` with a Zod `validate` function (`src/core/config`).** Typed `AppConfig` is injected
   via a token, and the app fails fast at boot with a readable error. `.env.example` is committed.

10. **Listing: cursor pagination** `orders(filter: { state }, first, after): OrderConnection` sorted by `_id desc`.
    Cursor = ObjectId, so pages stay stable under inserts and scale better than offset pagination.
    Index on `{ state: 1, _id: -1 }`.

11. **Temporal ✅: not included.** The workflow is a synchronous, 3-state and
    human-driven transition with no timers, retries, long-running side effects or cross-service
    saga. Temporal would add a server, workers, a second deployment and non-trivial local setup to
    solve a problem we do not have, which works against "keep the solution simple". The ADR explains
    *when* it would become the right tool: SLA timers (auto-escalate orders stuck in IN_PROGRESS),
    orchestrating picking/payment/notification services, or durable retries on side effects.
    MongoDB stays the source of truth for order state either way.

12. **Testing strategy (pyramid).**
    - Unit (Vitest): state machine, exhaustive over all `from × to` pairs + employee rule; Zod schemas; error mapping.
    - Integration (Jest or Vitest+SWC ¹, `@nestjs/testing` full `AppModule` + supertest against `/graphql` + `MongoMemoryReplSet`):
      each GraphQL operation end to end through the real DI graph against real Mongo semantics, including the concurrency race.
      ¹ Nest relies on `emitDecoratorMetadata`. Vitest needs `unplugin-swc` for that; if it is fragile, use Jest (Nest's default) for the API.
    - Frontend: a couple of RTL component tests with `MockedProvider`.
    - E2E (Playwright): one full-stack happy path + one rejected transition, run in CI via docker-compose.
    - Coverage gate on `apps/api` (target ≥ 90% lines on domain/application).

13. **Frontend (minimal): Vite + React + TS + Apollo Client + codegen.** Screens: orders list (state
    filter), order details with transition buttons (employee picker when starting), create-order form.
    Plain CSS, no UI kit. Its purpose is to make the demo tangible, not to be assessed.

14. **Git workflow.** `main` is protected: PR required, CI required, squash merge. Branches are named
    `feat/…`, `chore/…`, `ci/…`, `docs/…`, and the PR title is a Conventional Commit (it becomes the
    squash commit). Enforced by commitlint (husky `commit-msg`) + a PR-title check in CI.
    Commits and PR descriptions carry **no attribution trailers/footers** (`Co-Authored-By:`, "Generated with …"
    and the like): commitlint rejects such trailers and the CI PR check rejects them in the PR body. AI usage is
    disclosed in `AI_USAGE.md` instead.

15. **Deploy ✅: GCP Cloud Run (scale-to-zero, cold start accepted) + MongoDB Atlas M0 in the same region.**
    - **Two Cloud Run services:** `orders-api` (NestJS image) and `orders-web` (static build on nginx image). Region
      `europe-west1` (or wherever Atlas M0 on GCP is available closest to it, as long as both are in the same region). `min-instances=0`, `max-instances=2`
      for cost and blast-radius control.
    - **Images** go to Artifact Registry. **Secrets** (`DATABASE_URL`) live in Secret Manager and are mounted as env on Cloud Run.
    - **CI → GCP auth via Workload Identity Federation** (GitHub OIDC). There are no long-lived JSON keys in GitHub secrets.
      The deploy service account is least-privilege (`run.admin` on the two services, `artifactregistry.writer`, `iam.serviceAccountUser` on the runtime SA only).
    - **Pipeline:** on merge to `main`, once CI is green: build → push → `gcloud run deploy` → smoke test (`health` query on the new revision URL).
      Cloud Run keeps previous revisions, so rollback is a single `gcloud run services update-traffic`.
    - **Infra as code: Terraform (`infra/terraform`)** with providers `google` + `mongodbatlas` + `random`. It manages the
      enabled APIs, Artifact Registry, runtime + deploy service accounts and IAM, the WIF pool/provider bound to the repo,
      the Secret Manager secret, both Cloud Run services, **and** the Atlas project, M0 cluster, DB user (generated password → Secret Manager)
      and IP access list. Remote state lives in a GCS bucket (versioned). The bucket is created once by a documented one-liner (the
      chicken-and-egg problem). Terraform owns the *service shape* (env, secrets, scaling, IAM). CI owns the *image*:
      `lifecycle { ignore_changes = [image] }` avoids drift fights between `terraform apply` and `gcloud run deploy`.
      CI runs `terraform fmt -check` + `validate` on every PR, and `plan` is shown in the PR when `infra/**` changes.
      `apply` is manual (local or a `workflow_dispatch`), because infra changes in a demo are rare and deliberate.
    - **Cold start (accepted):** the ADR measures it (NestJS + Prisma boot time) and explains the mitigations: lazy work
      out of bootstrap, Prisma connect on first query vs `onModuleInit`, Cloud Run startup CPU boost, and `min-instances=1`
      as a one-flag switch for demo day or prod.
    - **Atlas network access:** `0.0.0.0/0` allowlist + a strong DB user scoped to one database (TLS is always on in Atlas).
      No VPC connector or NAT: this is a demo, just two services + Atlas.
    - **Graceful shutdown matters here:** Cloud Run sends SIGTERM before killing an instance, and `enableShutdownHooks()` closes Prisma cleanly.
    - Alternatives considered: GKE (overkill), App Engine (legacy-ish), Firebase Hosting for web (fine, but it's
      a second deploy toolchain; one platform keeps the pipeline uniform).

16. **AI usage is documented as we go.** `docs/AI_USAGE.md`: tools (Claude Code + agent-skills plan/review/test
    workflows, subagent code review), what was delegated vs decided by me, and how output was
    validated (tests first for domain rules, reading official docs for Prisma/Apollo, reviewing every
    diff in the PR, CI gates). The `tasks/` folder stays in the repo as evidence of the planning process.

## Dependency Graph

```
T1 monorepo tooling + CI
 └─ T2 API bootstrap (NestJS, GraphQL, config, logging, health)
     └─ T3 persistence (Prisma spike, docker-compose rs0, test harness)
         ├─ T4 domain state machine (pure; could start after T1)
         ├─ T5 create order + order details ──┐
         │   └─ T6 list orders                │
         ├─ T7 employees module + seed ───────┤
         └──────────────────────────────── T8 transitionOrder (needs T4, T5, T7)
                                               └─ T9 hardening (errors, limits, logging)
T10 web scaffold + list  (needs T6)
 └─ T11 details + transitions UI (needs T8)
     └─ T12 create-order UI + E2E
T13 Dockerfiles + full-stack compose (needs T9, T12)
 └─ T14 terraform infra (GCP + Atlas)
     └─ T15 deploy pipeline
T16 final docs (continuous; closes at the end)
```

## Task List

The full checklist with acceptance criteria is in [`tasks/todo.md`](./todo.md). **One task = one branch = one PR.**

### Phase 1: Foundation
- [x] T1 `chore: scaffold yarn monorepo with tooling and CI`
- [x] T2 `feat(api): bootstrap nestjs graphql api with config and health check`
- [x] T3 `feat(api): add prisma mongodb persistence and integration test harness`

### Checkpoint A: Foundation (after T3) ✅

### Phase 2: Core domain + API
- [x] T4 `feat(orders): implement order state machine domain`
- [x] T5 `feat(orders): create order and get order details`
- [x] T6 `feat(orders): list orders with state filter and cursor pagination`
- [x] T7 `feat(employees): add employees module with seed data`
- [x] T8 `feat(orders): transition orders through graphql mutation`
- [x] T9 `feat(api): harden error handling, input limits and request logging`

### Checkpoint B: API complete (after T9)

### Phase 3: Minimal frontend
- [x] T10 `feat(web): scaffold web app with orders list`
- [x] T11 `feat(web): order details with state transitions`
- [x] T12 `feat(web): create order form and e2e tests`

### Checkpoint C: Full stack (after T12)

### Phase 4: Ship
- [x] T13 `build: dockerize api and web with full-stack compose`
- [ ] T14 `feat(infra): provision gcp and atlas with terraform`
- [ ] T15 `ci: deploy to gcp cloud run on merge to main`
- [ ] T16 `docs: readme, architecture decisions and AI usage`

### Checkpoint D: Submission ready

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prisma 8 MongoDB support is recently re-added and may have gaps | High | Time-boxed spike at the start of T3; fall back to Prisma 6.19 and record it in an ADR |
| Prisma needs a replica set (local, CI, tests) | Med | Single-node `rs0` in compose with healthcheck init; `MongoMemoryReplSet` in tests; Atlas in prod |
| Race conditions on concurrent transitions | High (core rule) | Conditional `updateMany` + `version`; explicit parallel-requests integration test |
| Scope creep (Temporal, auth, fancy UI) dilutes the core | Med | Out of scope unless confirmed; the frontend is deliberately minimal |
| Terraform state holds the generated DB password | Med | GCS state bucket: private, versioned, uniform access, only the owner + deploy SA can read it |
| Cloud Run cold start (Nest + Prisma boot) visible during the live demo | Med | Measure it; startup CPU boost; warm-up request before the demo or flip `min-instances=1` that day; local `docker compose up` is always the fallback |
| Atlas allowlist `0.0.0.0/0` (accepted for the demo) | Low | Least-privilege DB user, TLS, strong generated password in Secret Manager |
| GCP credentials leaking via CI | High | Workload Identity Federation (OIDC), no JSON keys; least-privilege deploy SA |
| Codegen drift between API SDL and web | Low | Codegen runs in CI; typecheck fails on drift |

## Out of Scope (explicit assumptions)

- Authentication/authorization. Assumption: an internal store tool behind a gateway. Mentioned as the next step.
- Employee management CRUD. Employees are seeded reference data (id, name), exposed read-only.
- Customer as a separate aggregate. It is embedded as a snapshot on the order (name, email).
- Editing line items after creation, cancellation state. Neither is in the diagram, so neither is added.
- Unassigning or reassigning an employee. The assignment happens on `OPEN → IN_PROGRESS` and is kept on `COMPLETE` for history.

## Open Questions (need your decision)

Resolved (2026-09-21): NestJS (IoC made explicit, see 2a) · generic `transitionOrder` · no Temporal · GCP Cloud Run + Atlas M0 (cold start accepted) · repo `mm-store-apps-orders`, public.

Still open:
1. **GCP:** existing project ID with billing enabled, or create a new one? Is `gcloud` authenticated locally? (needed at T14)
2. **Atlas:** existing account/org? M0 cluster on GCP in the chosen region. (needed at T14)
