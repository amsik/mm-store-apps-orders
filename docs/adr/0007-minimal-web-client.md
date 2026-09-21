# 0007 — Minimal web client: Vite, React, Apollo Client and committed codegen

**Status:** Accepted (2026-09-21)

## Context

The backend is what is being assessed, but the demo needs a UI: list orders, open one, move it through its
states and create new ones. The UI must stay small, typed against the real contract, and cheap to keep in sync
with the API.

## Decision

- **Vite + React 19 + TypeScript**, plain CSS, no UI kit. Screens are hash routes (`#/`, `#/orders/:id`) read through
  `useSyncExternalStore`: every screen is linkable (handy for E2E and the demo) and the bundle stays static files with no
  server rewrites. A router library would earn its place with nested layouts or loaders, which three screens do not need.
- The details screen shows **only the next valid action** (Start with an employee picker, Complete, or nothing). The
  server stays the authority: when it rejects a transition (a race, stale data), the message is shown and the order is
  refetched, so the screen always ends up showing the stored state. The list uses `cache-and-network`, so it picks up
  transitions made on the details screen.
- **Apollo Client 4** with a normalized `InMemoryCache`. The `orders` field has a type policy: `keyArgs: ['filter']`
  keeps one list per state filter, and `merge` appends a page when the request has an `after` cursor and replaces
  the list otherwise. "Load more" is therefore just `fetchMore({ variables: { after: endCursor } })`.
- **GraphQL Code Generator (`client` preset)** reads the committed `apps/api/schema.gql` (ADR 0003) and emits typed
  documents into `apps/web/src/gql/`. The output is committed; CI regenerates it and fails on a diff. A schema change
  that breaks the web app therefore fails `typecheck` in the same PR.
- The API URL comes from `VITE_API_URL` at build time (default `http://localhost:3000/graphql`). The API allows the
  web origin through `CORS_ORIGINS` (ADR 0006), so no dev proxy is needed.
- The create-order form validates on the client with the **same rules and the same field paths** as the API
  (`customer.email`, `lineItems.0.quantity`), so a `BAD_USER_INPUT` from the server lands on the same fields as a
  client-side error. The client checks are a convenience; the API stays the authority (its email check is stricter).
  Prices are typed in euros and sent as integer cents.
- Tests: Vitest + jsdom + React Testing Library with Apollo's `MockedProvider`, using the real cache policy from
  `createCache()`, so pagination merging is tested too. **Playwright** runs the full stack (built API + built web app +
  MongoDB replica set from docker-compose, in a separate `mm-order-e2e` database) locally and as its own CI job.
  Locally, `E2E_BROWSER_CHANNEL=chrome` uses the installed Chrome instead of downloading Playwright's Chromium.

## Alternatives

- **Next.js / Remix.** SSR and routing conventions that a three-screen internal tool does not need, plus a Node
  server to deploy instead of static files.
- **urql or TanStack Query + `graphql-request`.** Smaller, but Apollo matches the Apollo Server side, and its
  normalized cache updates the list after a mutation without refetch plumbing.
- **Generating types at build time instead of committing them.** One generated folder fewer in the repo, but the
  contract diff disappears from PRs and every build needs the codegen step first.
- **Relay-style `edges { node }` pagination with `relayStylePagination()`.** The API exposes `nodes` + `pageInfo`
  (simpler for clients), so a ten-line custom `merge` is enough.

## Consequences

- One typed contract from the NestJS decorators to the React components.
- Contributors run `yarn workspace @app/web codegen` after changing a query or the schema; CI enforces it.
- The bundle is ~120 kB gzipped, mostly React and Apollo. That is acceptable for an internal tool.
