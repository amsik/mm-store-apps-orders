# 0003 — Code-first GraphQL schema

**Status:** Accepted (2026-09-21)

## Context

The GraphQL types must stay in sync with TypeScript types and validation, and the web client needs a
schema to generate its types from.

## Decision

Code-first with `@nestjs/graphql`: object and input types are TypeScript classes with decorators, and
`autoSchemaFile` emits `apps/api/schema.gql` (sorted, so the output is deterministic). The file is committed:

- it is the frontend codegen input (no running API needed to build the web app);
- schema changes show up as a reviewable contract diff in each PR;
- CI regenerates it during the integration tests and fails on `git diff` if the committed copy is stale.

In production the schema is built in memory (`autoSchemaFile: true`), so the container never writes to disk.
The file is excluded from Prettier because it is generated.

## Alternatives

- **Schema-first (SDL + codegen for resolvers).** Better when the schema is designed separately from the
  implementation or shared across teams. Here one team owns both sides, and schema-first means keeping SDL,
  generated types and validation decorators in sync by hand.
- **Not committing the SDL.** Removes a generated file from the repo, but loses the contract diff in PRs and
  makes the web build depend on a running API or a build step.

## Consequences

- One source of truth: a field is declared once, next to its validation rules.
- Contributors must run the tests (or the dev server) after changing GraphQL types, which CI enforces.
