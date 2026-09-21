# 0005 — Order state machine and transition API

**Status:** Accepted (2026-09-21)

## Context

An order moves strictly `OPEN → IN_PROGRESS → COMPLETE`. Skipping a state or going back is not allowed, and an
order can only be `IN_PROGRESS` with an employee assigned. These are the core business rules of the challenge, so
they must be easy to review, exhaustively tested, and impossible to bypass through the API or a concurrent request.

## Decision

- **A pure domain module** (`src/modules/orders/domain`) with no framework imports, enforced by an ESLint
  `no-restricted-imports` rule on every `modules/*/domain` folder:
  - `OrderState`: a const object plus a string-literal union (not a TS `enum`), so values are interchangeable with
    Prisma's generated `OrderState` type without casts.
  - `ORDER_TRANSITIONS: Record<OrderState, OrderState | null>`: the only allowed move out of each state; `null` = final.
    The table reads like the diagram, and `Record` over the union makes the compiler reject a missing state.
  - `nextState(state)` and `assertTransition(order, target, employeeId?)`, which throws typed errors:
    `InvalidTransitionError` (carries `from` and `to`; the message names the allowed next state or says the state is final)
    and `EmployeeRequiredError`.
  - The sequence is checked before the employee rule, so `COMPLETE → IN_PROGRESS` without an employee is reported
    as an illegal transition, the more fundamental problem.
  - Whether the employee exists is not decided here: it needs I/O, so the application service resolves it after
    this check (T8).
- **One generic mutation**, `transitionOrder(input: { orderId, targetState, employeeId })`. Skip and revert attempts
  are expressible and visibly rejected, which maps literally onto the requirement and makes the rules demonstrable.
- **Race safety lives in the database, not here** (T8): the update is conditional on the current `state` and a
  `version` field, so two concurrent `IN_PROGRESS` requests cannot both succeed. The domain function decides what
  is legal; the conditional update guarantees it still holds when the write happens.
- **Tests:** all 9 `from × to` pairs are generated from `ORDER_STATES`, so adding a state or an edge forces the
  test table to change. The domain folder has a 100% coverage threshold (lines, branches, functions, statements) in
  `vitest.config.js`, enforced in CI by `yarn test:cov`.

- **Implementation (T8):** `OrdersService.transition` loads the order, runs `assertTransition`, resolves the employee
  when starting (unknown → `NOT_FOUND`), then calls the repository's `transition`: one `updateMany` filtered on
  `{ id, state: from, version }` that sets the state, the `assignedEmployee` snapshot and `updatedAt`, pushes a
  `history` entry `{ from, to, at, employeeId }` (`at` from the injected `CLOCK`) and increments `version`.
  A miss (`count === 0`) is reported as `CONCURRENT_MODIFICATION` without a re-read: orders are never deleted, so
  the only way to miss is that another write got there first. The loser of a race sees either
  `CONCURRENT_MODIFICATION` (it read before the winner wrote) or `INVALID_TRANSITION` (after).
- `employeeId` is only used on the move to `IN_PROGRESS`. On `COMPLETE` it is ignored and the assigned employee stays;
  reassignment is out of scope.
- `INVALID_TRANSITION` (with `from`/`to` in `extensions`), `EMPLOYEE_REQUIRED` and `CONCURRENT_MODIFICATION` are mapped
  by `OrdersErrorFilter`, scoped to the orders resolver, because a filter in `core/` would have to import the orders
  module. T9 keeps it there, behind a global catch-all filter (ADR 0006).

## Alternatives

- **XState or another state-machine library:** worth it for hierarchical or parallel states, guards with side effects,
  or timers. For 3 states and 2 edges a lookup table is clearer and adds no dependency.
- **A transition map `Record<OrderState, OrderState[]>`:** allows branching (e.g. a future `CANCELLED`) but invites
  accidental extra edges. The single-successor table matches the strictly linear requirement; changing its shape
  later is a local change with the tests pinning the behaviour.
- **Intent mutations `startOrder(orderId, employeeId!)` / `completeOrder(orderId)`:** the schema itself would require
  the employee, and clients could not even express a skip. It is the more "GraphQL-idiomatic" design, but it hides the
  rule the challenge asks us to enforce and demonstrate. It stays a cheap evolution path: both would call the same service.
- **A rich `Order` entity class with a `transitionTo()` method:** it would put behaviour on the aggregate, but the
  order is persisted and read through Prisma as plain data; mapping to and from a class adds code without adding
  safety that the pure functions don't already give.

- **Compare-and-set on `state` alone:** enough today, since every transition changes the state and states never
  repeat. `version` costs one field and keeps the guard correct once an order can change without a transition
  (e.g. editing line items while OPEN).

## Consequences

- The state machine is tested in milliseconds with no container, database or mocks.
- Adding a state means one table entry and one enum value; the exhaustive tests and the `Record` type point at every
  place that needs a decision.
- Error-to-GraphQL mapping (`INVALID_TRANSITION`, `EMPLOYEE_REQUIRED`) happens at the API edge (T9), so the domain
  stays unaware of GraphQL.
- Orders stored before `version` existed don't match the conditional update and fail with `CONCURRENT_MODIFICATION`.
  Only local dev data from before T8 is affected: reset it with `docker compose down -v`, then
  `docker compose up -d mongo` and `yarn workspace @app/api seed`.
