import { describe, expect, it } from 'vitest';
import { EmployeeRequiredError, InvalidTransitionError } from './errors.js';
import { ORDER_STATES, ORDER_TRANSITIONS, OrderState } from './order-state.js';
import { assertTransition, nextState } from './state-machine.js';

const EMPLOYEE_ID = '665f1c2b8a1e4d0012345678';

const ALLOWED = new Set([
  `${OrderState.OPEN}->${OrderState.IN_PROGRESS}`,
  `${OrderState.IN_PROGRESS}->${OrderState.COMPLETE}`,
]);

// All 9 from × to pairs, so the table can't silently gain or lose an edge.
const PAIRS = ORDER_STATES.flatMap((from) =>
  ORDER_STATES.map((to) => ({ from, to, allowed: ALLOWED.has(`${from}->${to}`) })),
);

describe('ORDER_TRANSITIONS', () => {
  it('is the linear sequence OPEN → IN_PROGRESS → COMPLETE', () => {
    expect(ORDER_TRANSITIONS).toEqual({
      OPEN: OrderState.IN_PROGRESS,
      IN_PROGRESS: OrderState.COMPLETE,
      COMPLETE: null,
    });
  });

  it('has an entry for every state', () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATES].sort());
  });
});

describe('nextState', () => {
  it.each([
    [OrderState.OPEN, OrderState.IN_PROGRESS],
    [OrderState.IN_PROGRESS, OrderState.COMPLETE],
    [OrderState.COMPLETE, null],
  ])('%s → %s', (from, to) => {
    expect(nextState(from)).toBe(to);
  });
});

describe('assertTransition', () => {
  it('covers all 9 from × to pairs, exactly 2 of them allowed', () => {
    expect(PAIRS).toHaveLength(9);
    expect(PAIRS.filter((p) => p.allowed)).toHaveLength(2);
  });

  it.each(PAIRS.filter((p) => p.allowed))('allows $from → $to', ({ from, to }) => {
    expect(() => {
      assertTransition({ state: from }, to, EMPLOYEE_ID);
    }).not.toThrow();
  });

  it.each(PAIRS.filter((p) => !p.allowed))(
    'rejects $from → $to with InvalidTransitionError',
    ({ from, to }) => {
      let error: unknown;
      try {
        assertTransition({ state: from }, to, EMPLOYEE_ID);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect(error).toMatchObject({ from, to });
    },
  );

  it('explains the rejection and names the only allowed next state', () => {
    expect(() => {
      assertTransition({ state: OrderState.OPEN }, OrderState.COMPLETE, EMPLOYEE_ID);
    }).toThrow('Cannot move an order from OPEN to COMPLETE; the next state must be IN_PROGRESS');
  });

  it('says a COMPLETE order is final', () => {
    expect(() => {
      assertTransition({ state: OrderState.COMPLETE }, OrderState.OPEN, EMPLOYEE_ID);
    }).toThrow('Cannot move an order from COMPLETE to OPEN; COMPLETE is final');
  });

  describe('employee rule', () => {
    it.each([undefined, null, ''])('rejects OPEN → IN_PROGRESS with employeeId %j', (employeeId) => {
      expect(() => {
        assertTransition({ state: OrderState.OPEN }, OrderState.IN_PROGRESS, employeeId);
      }).toThrow(EmployeeRequiredError);
    });

    it('does not need an employee to complete (the one assigned on start is kept)', () => {
      expect(() => {
        assertTransition({ state: OrderState.IN_PROGRESS }, OrderState.COMPLETE);
      }).not.toThrow();
    });

    it('reports an illegal transition before a missing employee', () => {
      expect(() => {
        assertTransition({ state: OrderState.COMPLETE }, OrderState.IN_PROGRESS);
      }).toThrow(InvalidTransitionError);
    });
  });
});

describe('domain errors', () => {
  it('are named so logs and error mapping can tell them apart', () => {
    expect(new InvalidTransitionError(OrderState.OPEN, OrderState.COMPLETE).name).toBe(
      'InvalidTransitionError',
    );
    expect(new EmployeeRequiredError().name).toBe('EmployeeRequiredError');
  });
});
