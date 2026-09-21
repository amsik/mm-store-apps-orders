import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateOrderInput, OrderArgs } from './order.inputs.js';

const VALID = {
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [{ sku: 'TV-55', name: 'Television 55"', quantity: 2, unitPriceCents: 49_900 }],
};

/** Property paths of the failed constraints, e.g. `lineItems.0.quantity`, as the ValidationPipe sees them. */
async function failedPaths(cls: new () => object, plain: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain));
  const paths: string[] = [];
  const walk = (list: typeof errors, prefix: string): void => {
    for (const error of list) {
      const path = prefix + error.property;
      if (error.constraints) paths.push(path);
      walk(error.children ?? [], `${path}.`);
    }
  };
  walk(errors, '');
  return paths;
}

const withItem = (patch: object) => ({ ...VALID, lineItems: [{ ...VALID.lineItems[0], ...patch }] });
const withCustomer = (patch: object) => ({ ...VALID, customer: { ...VALID.customer, ...patch } });

describe('CreateOrderInput', () => {
  it('accepts a valid order', async () => {
    expect(await failedPaths(CreateOrderInput, VALID)).toEqual([]);
  });

  it('accepts a free item (price 0)', async () => {
    expect(await failedPaths(CreateOrderInput, withItem({ unitPriceCents: 0 }))).toEqual([]);
  });

  it.each([
    ['no line items', { ...VALID, lineItems: [] }, 'lineItems'],
    ['more than 100 line items', { ...VALID, lineItems: Array(101).fill(VALID.lineItems[0]) }, 'lineItems'],
    ['quantity 0', withItem({ quantity: 0 }), 'lineItems.0.quantity'],
    ['a fractional quantity', withItem({ quantity: 1.5 }), 'lineItems.0.quantity'],
    ['quantity above 1000', withItem({ quantity: 1001 }), 'lineItems.0.quantity'],
    ['a negative price', withItem({ unitPriceCents: -1 }), 'lineItems.0.unitPriceCents'],
    ['a fractional price', withItem({ unitPriceCents: 9.99 }), 'lineItems.0.unitPriceCents'],
    ['an empty sku', withItem({ sku: '' }), 'lineItems.0.sku'],
    ['a sku over 64 chars', withItem({ sku: 'x'.repeat(65) }), 'lineItems.0.sku'],
    ['an empty item name', withItem({ name: '' }), 'lineItems.0.name'],
    ['an item name over 200 chars', withItem({ name: 'x'.repeat(201) }), 'lineItems.0.name'],
    ['an empty customer name', withCustomer({ name: '' }), 'customer.name'],
    ['a customer name over 200 chars', withCustomer({ name: 'x'.repeat(201) }), 'customer.name'],
    ['a bad email', withCustomer({ email: 'not-an-email' }), 'customer.email'],
  ])('rejects %s', async (_case, input, path) => {
    expect(await failedPaths(CreateOrderInput, input)).toEqual([path]);
  });
});

describe('OrderArgs', () => {
  it('accepts an ObjectId', async () => {
    expect(await failedPaths(OrderArgs, { id: '665f1c2b8a1e4d0012345678' })).toEqual([]);
  });

  it('rejects a malformed id', async () => {
    expect(await failedPaths(OrderArgs, { id: 'nope' })).toEqual(['id']);
  });
});
