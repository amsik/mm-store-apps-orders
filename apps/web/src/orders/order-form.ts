import { CombinedGraphQLErrors } from '@apollo/client';
import type { CreateOrderInput } from '../gql/graphql';

// Mirrors the API's input rules (apps/api/src/modules/orders/graphql/order.inputs.ts) so most mistakes are caught
// before a round trip. The API stays the authority: e.g. its email check is stricter, and its field errors are shown
// in the same places as these.
export const MAX_LINE_ITEMS = 100;
const MAX_QUANTITY = 1000;

export interface LineItemForm {
  sku: string;
  name: string;
  quantity: string;
  /** Euros as typed, e.g. "19.99"; sent as integer cents. */
  unitPrice: string;
}

export interface OrderForm {
  customer: { name: string; email: string };
  lineItems: LineItemForm[];
}

/** Error message by field path, using the API's dotted paths (`customer.email`, `lineItems.0.quantity`). */
export type FieldErrors = Record<string, string>;

export const emptyLineItem = (): LineItemForm => ({ sku: '', name: '', quantity: '1', unitPrice: '' });

export const emptyOrderForm = (): OrderForm => ({
  customer: { name: '', email: '' },
  lineItems: [emptyLineItem()],
});

const EMAIL = /^[^\s@]+@[^\s@]+$/;
const WHOLE_NUMBER = /^\d+$/;
const EUROS = /^\d+(\.\d{1,2})?$/;

function text(value: string, max: number, required: string): string | undefined {
  if (!value.trim()) return required;
  if (value.trim().length > max) return `At most ${String(max)} characters`;
  return undefined;
}

export function validateOrderForm(form: OrderForm): FieldErrors {
  const errors: Record<string, string | undefined> = {
    'customer.name': text(form.customer.name, 200, 'Name is required'),
    'customer.email':
      text(form.customer.email, 254, 'Email is required') ??
      (EMAIL.test(form.customer.email.trim()) ? undefined : 'Enter a valid email'),
  };
  if (form.lineItems.length === 0) errors.lineItems = 'Add at least one line item';
  if (form.lineItems.length > MAX_LINE_ITEMS)
    errors.lineItems = `At most ${String(MAX_LINE_ITEMS)} line items`;

  form.lineItems.forEach((item, index) => {
    const path = `lineItems.${String(index)}`;
    const quantity = Number(item.quantity);
    errors[`${path}.sku`] = text(item.sku, 64, 'SKU is required');
    errors[`${path}.name`] = text(item.name, 200, 'Name is required');
    errors[`${path}.quantity`] =
      WHOLE_NUMBER.test(item.quantity) && quantity >= 1 && quantity <= MAX_QUANTITY
        ? undefined
        : `Whole number from 1 to ${String(MAX_QUANTITY)}`;
    errors[`${path}.unitPrice`] = EUROS.test(item.unitPrice) ? undefined : 'Price in euros, e.g. 19.99';
  });

  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

export const toCreateOrderInput = (form: OrderForm): CreateOrderInput => ({
  customer: { name: form.customer.name.trim(), email: form.customer.email.trim() },
  lineItems: form.lineItems.map((item) => ({
    sku: item.sku.trim(),
    name: item.name.trim(),
    quantity: Number(item.quantity),
    unitPriceCents: Math.round(Number(item.unitPrice) * 100),
  })),
});

interface ServerFieldError {
  path: string;
  messages: string[];
}

const isFieldErrorList = (value: unknown): value is ServerFieldError[] =>
  Array.isArray(value) &&
  value.every(
    (entry: unknown) => typeof entry === 'object' && entry !== null && 'path' in entry && 'messages' in entry,
  );

/** The API's `BAD_USER_INPUT` field details as form errors, or null when the error has none. */
export function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!CombinedGraphQLErrors.is(error)) return null;
  const fields = error.errors.find((entry) => entry.extensions?.code === 'BAD_USER_INPUT')?.extensions
    ?.fields;
  if (!isFieldErrorList(fields) || fields.length === 0) return null;
  return Object.fromEntries(
    fields.map(({ path, messages }) => [
      path.replace(/\.unitPriceCents$/, '.unitPrice'),
      messages.join('; '),
    ]),
  );
}
