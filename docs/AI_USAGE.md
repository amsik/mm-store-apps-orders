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
