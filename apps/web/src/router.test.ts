import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it.each([
    ['', { name: 'orders' }],
    ['#/', { name: 'orders' }],
    ['#/orders/665f00000000000000000001', { name: 'order', id: '665f00000000000000000001' }],
    ['#/unknown', { name: 'orders' }],
  ])('maps %j to %j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });
});

describe('parseRoute — new order', () => {
  it('maps #/new to the create screen', () => {
    expect(parseRoute('#/new')).toEqual({ name: 'new' });
  });
});
