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
