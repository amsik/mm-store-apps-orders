# 0002 — NestJS as IoC container and application framework

**Status:** Accepted (2026-09-21)

## Context

The challenge asks for Node.js + TypeScript, an IoC container of our choice, functional modules and
configuration management. The IoC requirement is easy to "satisfy" invisibly inside a framework, so the
choice must also make dependency inversion visible in code and tests.

## Decision

**NestJS 12** (`@nestjs/core` injector) with `@nestjs/graphql` + `ApolloDriver` (Apollo Server 5).

- **Composition root:** `AppModule` and each feature module's `providers`. Concrete classes are bound to
  abstractions only there; nothing else calls `new` on a service or repository.
- **Tokens for abstractions** (`src/core/di/tokens.ts`): consumers inject a token and type against an interface.
  T2 introduces `APP_CONFIG` (typed `AppConfig`, `useFactory` over `ConfigService` + Zod) and `CLOCK`
  (`systemClock`, `useValue`); `ORDER_REPOSITORY` and `EMPLOYEE_DIRECTORY` follow with the domain modules.
- **Scopes:** all providers are singletons. Request context (request id) will come from nestjs-pino's
  AsyncLocalStorage rather than request-scoped providers, which would re-create the whole dependency chain per request.
- **Config:** `@nestjs/config` + a Zod `validate` hook. The app fails at boot with every invalid key listed.
  An ESLint rule forbids `process.env` under `apps/api/src`, so `APP_CONFIG` is the only way in.
- **Proof in tests:** integration tests boot the real module graph and swap bindings with
  `Test.createTestingModule(...).overrideProvider(APP_CONFIG)`; unit tests construct services directly with fakes.

### Nest 12 instead of the planned 11

The plan named Nest 11. Nest 12 was the current major when implementation began and is ESM-only, which matches
the repo (`"type": "module"`, `NodeNext`). The whole stack (`@nestjs/graphql` 14, `@nestjs/apollo` 14,
`@nestjs/config` 12, `nestjs-pino` 5) declares support for it, and the integration tests pass under it. Fallback
if an ecosystem package lags: pin 11 and switch the API workspace to CommonJS.

### Test runner: Vitest + SWC

Nest resolves constructor parameters from `design:paramtypes` metadata. Vitest's default transformer (esbuild)
does not emit it, so `apps/api/vitest.config.js` transforms through `unplugin-swc` with `decoratorMetadata`.
This keeps one test runner across the repo and native ESM, instead of adding Jest (Nest's default) for one workspace.

## Alternatives

- **Awilix + plain Apollo Server.** Explicit registration, no decorators, very transparent. We would hand-build
  modules, lifecycle hooks, validation and the Apollo integration that Nest provides.
- **InversifyJS / tsyringe.** Decorator-based containers without an application framework; same hand-assembly cost.
- **Manual constructor wiring.** Zero magic and fine at this size, but it does not demonstrate an IoC container,
  which the challenge asks for.

## Consequences

- DI, module boundaries, lifecycle hooks (graceful shutdown on Cloud Run SIGTERM) and GraphQL integration come
  from one widely known framework.
- Decorator metadata ties us to `experimentalDecorators` + `emitDecoratorMetadata` and to SWC in tests.
- Circular imports between decorated classes are a known ESM pitfall (TDZ on `design:type`); GraphQL fields
  use lazy `() => Type` references and the domain model avoids cycles.
