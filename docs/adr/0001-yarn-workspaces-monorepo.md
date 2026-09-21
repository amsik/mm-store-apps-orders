# 0001 — Yarn workspaces monorepo

**Status:** Accepted (2026-09-21)

## Context

The deliverable is a GraphQL API (the assessed part) plus a deliberately minimal web client for the live demo.
Both change together: a schema change is usually followed by a client change.

## Decision

One repository, Yarn 4 workspaces (`nodeLinker: node-modules`), with `apps/api` and `apps/web`. Shared tooling
(TypeScript base config, ESLint, Prettier, Vitest, commitlint) lives at the root. No shared package: the web app
generates its types from the committed `apps/api/schema.gql`.

## Alternatives

- **Two repositories.** Two CI pipelines and non-atomic cross-stack changes, which is a poor trade for a 2-app project.
- **Turborepo / Nx.** Task caching and project graphs pay off with many packages; with two apps they are extra
  configuration without a measurable benefit.
- **pnpm workspaces.** Equally valid. Yarn 4 was chosen for Corepack-pinned versions and the `workspaces foreach` runner.

## Consequences

- One CI workflow gates every change; a PR can change the schema and its client atomically.
- `node-modules` linker (not PnP) keeps compatibility with Nest, Prisma and editor tooling.
- If more apps or shared libraries appear, adding Turborepo on top is non-breaking.
