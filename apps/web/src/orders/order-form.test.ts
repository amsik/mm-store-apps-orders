import { CombinedGraphQLErrors } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import {
  emptyLineItem,
  serverFieldErrors,
  toCreateOrderInput,
  validateOrderForm,
  type OrderForm,
} from './order-form';

const validForm = (): OrderForm => ({
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [{ sku: 'TV-55', name: 'OLED TV', quantity: '2', unitPrice: '499.99' }],
});

describe('validateOrderForm', () => {
  it('accepts a valid form', () => {
    expect(validateOrderForm(validForm())).toEqual({});
  });

  it('reports errors under the same paths the API uses', () => {
    const form: OrderForm = {
      customer: { name: '  ', email: 'not-an-email' },
      lineItems: [{ sku: '', name: 'x'.repeat(201), quantity: '0', unitPrice: '-1' }],
    };

    expect(validateOrderForm(form)).toEqual({
      'customer.name': 'Name is required',
      'customer.email': 'Enter a valid email',
      'lineItems.0.sku': 'SKU is required',
      'lineItems.0.name': 'At most 200 characters',
      'lineItems.0.quantity': 'Whole number from 1 to 1000',
      'lineItems.0.unitPrice': 'Price in euros, e.g. 19.99',
    });
  });

  it.each(['1.5', '1001', 'abc', ''])('rejects quantity %j', (quantity) => {
    const form = validForm();
    form.lineItems[0] = { ...emptyLineItem(), sku: 'A', name: 'B', unitPrice: '1', quantity };
    expect(validateOrderForm(form)).toHaveProperty(['lineItems.0.quantity']);
  });

  it.each(['0', '19.9', '19.99', '1000'])('accepts price %j', (unitPrice) => {
    const form = validForm();
    form.lineItems[0] = { sku: 'A', name: 'B', quantity: '1', unitPrice };
    expect(validateOrderForm(form)).toEqual({});
  });

  it.each(['19.999', '1,5', ''])('rejects price %j', (unitPrice) => {
    const form = validForm();
    form.lineItems[0] = { sku: 'A', name: 'B', quantity: '1', unitPrice };
    expect(validateOrderForm(form)).toHaveProperty(['lineItems.0.unitPrice']);
  });

  it('requires at least one line item', () => {
    expect(validateOrderForm({ ...validForm(), lineItems: [] })).toEqual({
      lineItems: 'Add at least one line item',
    });
  });
});

describe('toCreateOrderInput', () => {
  it('trims text and converts quantity and euros to integers', () => {
    const form = validForm();
    form.customer.name = ' Ada Lovelace ';
    form.lineItems.push({ sku: 'C', name: 'Cable', quantity: '3', unitPrice: '0.1' });

    expect(toCreateOrderInput(form)).toEqual({
      customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
      lineItems: [
        { sku: 'TV-55', name: 'OLED TV', quantity: 2, unitPriceCents: 49999 },
        { sku: 'C', name: 'Cable', quantity: 3, unitPriceCents: 10 },
      ],
    });
  });
});

describe('serverFieldErrors', () => {
  it('maps BAD_USER_INPUT field details to form paths', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            code: 'BAD_USER_INPUT',
            fields: [
              { path: 'customer.email', messages: ['email must be an email'] },
              { path: 'lineItems.0.unitPriceCents', messages: ['unitPriceCents must not be less than 0'] },
            ],
          },
        },
      ],
    });

    expect(serverFieldErrors(error)).toEqual({
      'customer.email': 'email must be an email',
      'lineItems.0.unitPrice': 'unitPriceCents must not be less than 0',
    });
  });

  it('returns null for errors without field details', () => {
    expect(serverFieldErrors(new Error('Failed to fetch'))).toBeNull();
    expect(
      serverFieldErrors(
        new CombinedGraphQLErrors({ errors: [{ message: 'boom', extensions: { code: 'X' } }] }),
      ),
    ).toBeNull();
  });
});
