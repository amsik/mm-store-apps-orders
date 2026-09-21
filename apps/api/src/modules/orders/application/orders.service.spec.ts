import { beforeEach, describe, expect, it } from 'vitest';
import { OrderState } from '../domain/order-state.js';
import { InMemoryOrderRepository } from '../testing/in-memory-order.repository.js';
import { OrderNotFoundError } from './errors.js';
import { OrdersService } from './orders.service.js';

const NOW = new Date('2026-09-21T10:00:00.000Z');

const INPUT = {
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [{ sku: 'TV-55', name: 'Television 55"', quantity: 1, unitPriceCents: 49_900 }],
};

describe('OrdersService', () => {
  let repository: InMemoryOrderRepository;
  let service: OrdersService;

  beforeEach(() => {
    // Plain constructor injection: no Nest container needed to test the application layer.
    repository = new InMemoryOrderRepository({ now: () => NOW });
    service = new OrdersService(repository);
  });

  describe('create', () => {
    it('creates an OPEN order with the customer and line items and no employee', async () => {
      const order = await service.create(INPUT);

      expect(order).toEqual({
        id: expect.any(String) as string,
        state: OrderState.OPEN,
        customer: INPUT.customer,
        lineItems: INPUT.lineItems,
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
});
