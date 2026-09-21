import { describe, expect, it } from 'vitest';
import { formatCents, orderTotalCents } from './format';

describe('formatCents', () => {
  it('formats integer cents as euros', () => {
    expect(formatCents(123456)).toBe('€1,234.56');
    expect(formatCents(0)).toBe('€0.00');
  });
});

describe('orderTotalCents', () => {
  it('sums quantity × unit price over all line items', () => {
    expect(
      orderTotalCents([
        { quantity: 2, unitPriceCents: 1999 },
        { quantity: 1, unitPriceCents: 500 },
      ]),
    ).toBe(4498);
  });

  it('is 0 without line items', () => {
    expect(orderTotalCents([])).toBe(0);
  });
});
