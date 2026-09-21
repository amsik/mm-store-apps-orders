# 0006 — Error handling, request ids and API limits

**Status:** Accepted (2026-09-21)

## Context

Clients branch on `extensions.code`, so every error must leave the API with a code from one catalog. Unexpected
errors (a database outage, a bug) must not leak messages, connection strings or stack traces in production, yet
whoever gets the error has to be able to find it in the logs. The API is public (Cloud Run with public invoker), so
it also needs basic protection against oversized and deeply nested requests, and against browser origins we do not serve.

## Decision

- **Error catalog** (`core/errors/error-codes.ts`): `BAD_USER_INPUT`, `NOT_FOUND`, `INVALID_TRANSITION`,
  `EMPLOYEE_REQUIRED`, `CONCURRENT_MODIFICATION`, `INTERNAL_SERVER_ERROR`. Apollo's own codes for requests that
  never execute (`GRAPHQL_PARSE_FAILED`, `GRAPHQL_VALIDATION_FAILED`, `BAD_REQUEST`) pass through unchanged.
  Each code has at least one integration test.
- **Mapping in two layers of exception filters.**
  - A feature maps its own errors at its API edge: `OrdersErrorFilter` on the orders resolver handles
    `INVALID_TRANSITION`, `EMPLOYEE_REQUIRED` and `CONCURRENT_MODIFICATION`. It stays in the feature: moving it to
    `core/` would make core import the orders domain. The domain can't import a shared base class from `core/`
    either, because the ESLint boundary rule forbids it.
  - The global `AppErrorFilter` (`@Catch()`) is the catch-all behind it. It passes `GraphQLError`s through (e.g. the
    `ValidationPipe`'s `BAD_USER_INPUT`), maps the shared `NotFoundError` base class to `NOT_FOUND`, and turns
    anything else into `INTERNAL_SERVER_ERROR` with `extensions.requestId`. The error is logged at `error` level
    with its stack and the request id. The message is replaced with `Internal server error` in production and kept
    in development to ease debugging.
  - Nest also sends HTTP-level errors (e.g. body-parser's 413) to global filters. These have no GraphQL response to
    return into, so the filter hands them to Nest's `BaseExceptionFilter`. Without that the request would hang,
    and the 413 test caught exactly this.
- **`formatError` backstop:** errors raised outside resolvers (e.g. scalar serialization) never reach the filters.
  In production, Apollo's `formatError` reduces any `INTERNAL_SERVER_ERROR`, or any error with no code, to its code
  and request id. `includeStacktraceInErrorResponses` is set from our config, because Apollo would otherwise decide
  from `process.env.NODE_ENV`.
- **Request id:** pino-http `genReqId` reuses an incoming `x-request-id` when it matches `^[\w.-]{1,128}$`, so the web
  app or a proxy can correlate calls. Otherwise it generates a UUID, since a free-form value could forge or bloat log
  lines. The id is echoed in the `x-request-id` response header and bound to every log line of the request through
  nestjs-pino's AsyncLocalStorage (`req.id`), so no request-scoped providers are needed.
- **Limits and exposure**, all set from config (`AppConfig`) and validated at boot:
  - Query depth: `@escape.tech/graphql-armor-max-depth` as an Apollo `validationRule`, `GRAPHQL_MAX_DEPTH`
    (default 8), with introspection exempt. It reports through the validation context
    (`propagateOnRejection: false`) rather than throwing, so a deep query gets a normal 400
    `GRAPHQL_VALIDATION_FAILED` before any resolver runs. The current schema has no cycles and its deepest real
    query has depth 4, so the limit protects against future relations (e.g. `employee.orders`).
  - Body size: JSON body limit `100kb` (explicit, same as Express's default), rejected with 413 before parsing.
  - CORS: `CORS_ORIGINS` is a comma-separated allow-list of http(s) origins. When empty, no cross-origin access is allowed.
  - `GRAPHQL_INTROSPECTION` turns introspection and the GraphiQL page on or off together. It defaults to off in
    production and can be turned on explicitly, e.g. for a demo.

## Alternatives

- **One central mapper in `core/` that knows every feature error:** a single table, but core would depend on every
  feature, and adding a feature would mean editing core. A registry of per-feature mappers behind a DI token avoids
  that dependency, but for one feature it is more machinery than a resolver-scoped filter.
- **Errors carrying their own `code` (a shared `AppError` base class):** the simplest mapping, but the domain would
  have to import `core/`, which the layering rule forbids. The domain would also learn the API's error vocabulary.
- **Typed result unions** (`TransitionResult = Order | InvalidTransition`): explicit in the schema, but every client
  query needs fragments per outcome. Kept as an evolution path (plan decision 7).
- **Masking only in `formatError`:** it has no access to the request, so the masked error could not carry the
  request id, and it runs after Apollo has already chosen a code for the unknown error.
- **`graphql-depth-limit`:** the long-standing option, but unmaintained since 2019 and untyped. graphql-armor is
  maintained, typed and also offers cost, alias and directive limits if they are needed later.
- **Query cost analysis and rate limiting:** worthwhile for a public API with heavy list fields. `first` is already
  capped at 100 and depth is limited. Rate limiting belongs in front of the service (Cloud Armor or an API gateway)
  rather than in each replica.

## Consequences

- Clients can rely on a closed set of codes, and a production error report is one request id away from its log line.
- A new feature adds its own filter (or throws `NotFoundError` subclasses) and gets the catch-all for free.
- `NODE_ENV=production` changes the API's surface (masked messages, no introspection or GraphiQL unless enabled), so
  the deploy smoke test (T15) must not rely on introspection.
