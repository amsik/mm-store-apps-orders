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
});
