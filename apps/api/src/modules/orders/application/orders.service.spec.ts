import { beforeEach, describe, expect, it } from 'vitest';
import type { EmployeeDirectory } from '../../employees/application/employee-directory.js';
import { EmployeeRequiredError, InvalidTransitionError } from '../domain/errors.js';
import type { Order } from '../domain/order.js';
import { OrderState } from '../domain/order-state.js';
import { InMemoryOrderRepository } from '../testing/in-memory-order.repository.js';
import { ConcurrentModificationError, EmployeeNotFoundError, OrderNotFoundError } from './errors.js';
import { OrdersService } from './orders.service.js';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const LATER = new Date('2026-09-21T10:05:00.000Z');
const LATEST = new Date('2026-09-21T10:30:00.000Z');

const ALICE = { id: '66f0e0000000000000000001', name: 'Alice Schmidt' };
const BRUNO = { id: '66f0e0000000000000000002', name: 'Bruno Weber' };
const UNKNOWN_ID = '665f1c2b8a1e4d0012345678';

/** Fake directory: the service only needs the `EmployeeDirectory` port, not the employees module. */
const directory: EmployeeDirectory = {
  getById: (id) => Promise.resolve([ALICE, BRUNO].find((employee) => employee.id === id) ?? null),
};

const INPUT = {
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [{ sku: 'TV-55', name: 'Television 55"', quantity: 1, unitPriceCents: 49_900 }],
};

describe('OrdersService', () => {
  let repository: InMemoryOrderRepository;
  let service: OrdersService;
  let now: Date;

  beforeEach(() => {
    now = NOW;
    const clock = { now: () => now };
    // Plain constructor injection: no Nest container needed to test the application layer.
    repository = new InMemoryOrderRepository(clock);
    service = new OrdersService(repository, directory, clock);
  });

  describe('create', () => {
    it('creates an OPEN order with the customer and line items and no employee', async () => {
      const order = await service.create(INPUT);

      expect(order).toEqual({
        id: expect.any(String) as string,
        state: OrderState.OPEN,
        customer: INPUT.customer,
        lineItems: INPUT.lineItems,
        assignedEmployee: null,
        history: [],
        version: 0,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('persists the order', async () => {
      const order = await service.create(INPUT);

      expect(await repository.findById(order.id)).toEqual(order);
    });
  });

  describe('getById', () => {
    it('returns an existing order', async () => {
      const created = await service.create(INPUT);

      expect(await service.getById(created.id)).toEqual(created);
    });

    it('throws OrderNotFoundError carrying the id for an unknown order', async () => {
      const id = '665f1c2b8a1e4d0012345678';

      await expect(service.getById(id)).rejects.toThrow(OrderNotFoundError);
      await expect(service.getById(id)).rejects.toMatchObject({ id });
    });
  });

  describe('list', () => {
    /** Creates `count` orders oldest first and returns their ids newest first, the order `list` uses. */
    async function seed(count: number, state: OrderState = OrderState.OPEN): Promise<string[]> {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) ids.unshift((await repository.create({ ...INPUT, state })).id);
      return ids;
    }

    it('returns an empty page when there are no orders', async () => {
      expect(await service.list({ first: 10 })).toEqual({ nodes: [], endCursor: null, hasNextPage: false });
    });

    it('returns orders newest first', async () => {
      const ids = await seed(3);

      const page = await service.list({ first: 10 });

      expect(page.nodes.map((order) => order.id)).toEqual(ids);
      expect(page.hasNextPage).toBe(false);
      expect(page.endCursor).toBe(ids[2]);
    });

    it('pages through 25 orders 10 at a time with no duplicates or gaps', async () => {
      const ids = await seed(25);

      const first = await service.list({ first: 10 });
      const second = await service.list({ first: 10, after: first.endCursor ?? undefined });
      const third = await service.list({ first: 10, after: second.endCursor ?? undefined });

      expect([first, second, third].map((page) => page.nodes.length)).toEqual([10, 10, 5]);
      expect([first, second, third].map((page) => page.hasNextPage)).toEqual([true, true, false]);
      expect([...first.nodes, ...second.nodes, ...third.nodes].map((order) => order.id)).toEqual(ids);
    });

    it('reports no next page when the last page is exactly full', async () => {
      await seed(10);

      expect((await service.list({ first: 10 })).hasNextPage).toBe(false);
    });

    it('filters by state', async () => {
      await seed(2, OrderState.OPEN);
      const inProgress = await seed(3, OrderState.IN_PROGRESS);

      const page = await service.list({ first: 10, state: OrderState.IN_PROGRESS });

      expect(page.nodes.map((order) => order.id)).toEqual(inProgress);
    });
  });

  describe('transition', () => {
    let open: Order;

    beforeEach(async () => {
      open = await service.create(INPUT);
    });

    const start = (orderId: string, employeeId?: string) =>
      service.transition({ orderId, targetState: OrderState.IN_PROGRESS, employeeId });
    const complete = (orderId: string, employeeId?: string) =>
      service.transition({ orderId, targetState: OrderState.COMPLETE, employeeId });

    it('starts an OPEN order, assigning the employee and recording the change', async () => {
      now = LATER;

      const started = await start(open.id, ALICE.id);

      expect(started).toEqual({
        ...open,
        state: OrderState.IN_PROGRESS,
        assignedEmployee: ALICE,
        history: [{ from: OrderState.OPEN, to: OrderState.IN_PROGRESS, at: LATER, employeeId: ALICE.id }],
        version: 1,
        updatedAt: LATER,
      });
      expect(await repository.findById(open.id)).toEqual(started);
    });

    it('completes an IN_PROGRESS order, keeping the assigned employee', async () => {
      now = LATER;
      await start(open.id, ALICE.id);
      now = LATEST;

      const completed = await complete(open.id);

      expect(completed.state).toBe(OrderState.COMPLETE);
      expect(completed.assignedEmployee).toEqual(ALICE);
      expect(completed.updatedAt).toEqual(LATEST);
      expect(completed.version).toBe(2);
      expect(completed.history).toEqual([
        { from: OrderState.OPEN, to: OrderState.IN_PROGRESS, at: LATER, employeeId: ALICE.id },
        { from: OrderState.IN_PROGRESS, to: OrderState.COMPLETE, at: LATEST, employeeId: ALICE.id },
      ]);
    });

    it('ignores an employee passed on completion: the one assigned on start stays', async () => {
      await start(open.id, ALICE.id);

      const completed = await complete(open.id, BRUNO.id);

      expect(completed.assignedEmployee).toEqual(ALICE);
      expect(completed.history.at(-1)?.employeeId).toBe(ALICE.id);
    });

    describe('rejections leave the order untouched', () => {
      it.each([
        ['a skip (OPEN → COMPLETE)', () => complete(open.id), InvalidTransitionError],
        [
          'a repeat (OPEN → OPEN)',
          () => service.transition({ orderId: open.id, targetState: OrderState.OPEN }),
          InvalidTransitionError,
        ],
        ['IN_PROGRESS without an employee', () => start(open.id), EmployeeRequiredError],
        ['IN_PROGRESS with an unknown employee', () => start(open.id, UNKNOWN_ID), EmployeeNotFoundError],
      ])('rejects %s', async (_case, act, error) => {
        await expect(act()).rejects.toThrow(error);
        expect(await repository.findById(open.id)).toEqual(open);
      });

      it('rejects a revert (IN_PROGRESS → OPEN)', async () => {
        const started = await start(open.id, ALICE.id);

        await expect(service.transition({ orderId: open.id, targetState: OrderState.OPEN })).rejects.toThrow(
          InvalidTransitionError,
        );
        expect(await repository.findById(open.id)).toEqual(started);
      });

      it('rejects any move out of COMPLETE', async () => {
        await start(open.id, ALICE.id);
        const completed = await complete(open.id);

        await expect(start(open.id, BRUNO.id)).rejects.toThrow(InvalidTransitionError);
        expect(await repository.findById(open.id)).toEqual(completed);
      });

      it('names the unknown employee', async () => {
        await expect(start(open.id, UNKNOWN_ID)).rejects.toMatchObject({ id: UNKNOWN_ID });
      });
    });

    it('throws OrderNotFoundError for an unknown order', async () => {
      await expect(start(UNKNOWN_ID, ALICE.id)).rejects.toThrow(OrderNotFoundError);
    });

    it('lets exactly one of two concurrent starts win; the other gets ConcurrentModificationError', async () => {
      // Both calls read version 0 before either writes, so the loser's conditional update matches nothing.
      const results = await Promise.allSettled([start(open.id, ALICE.id), start(open.id, BRUNO.id)]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(ConcurrentModificationError);

      const stored = await repository.findById(open.id);
      expect(stored?.history).toHaveLength(1);
      expect(stored?.assignedEmployee).toEqual(fulfilled[0]?.value.assignedEmployee);
    });
  });
});
