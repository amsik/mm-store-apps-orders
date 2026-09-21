import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { GraphQLError } from 'graphql';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createCache } from '../apollo';
import { orderDetails } from '../test/fixtures';
import { CreateOrderForm } from './CreateOrderForm';
import { CREATE_ORDER_MUTATION } from './documents';

const input = {
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [
    { sku: 'TV-55', name: 'OLED TV', quantity: 1, unitPriceCents: 49900 },
    { sku: 'HDMI-2', name: 'HDMI cable', quantity: 2, unitPriceCents: 1250 },
  ],
};

const renderForm = (mocks: MockLink.MockedResponse[], onCreated = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} cache={createCache()}>
      <CreateOrderForm onCreated={onCreated} />
    </MockedProvider>,
  );
  return onCreated;
};

const fillCustomer = async (name: string, email: string) => {
  await userEvent.type(screen.getByLabelText(/customer name/i), name);
  await userEvent.type(screen.getByLabelText(/email/i), email);
};

const fillItem = async (
  index: number,
  item: { sku: string; name: string; quantity: string; price: string },
) => {
  const row = `item ${String(index + 1)}`;
  await userEvent.type(screen.getByLabelText(new RegExp(`${row} sku`, 'i')), item.sku);
  await userEvent.type(screen.getByLabelText(new RegExp(`${row} name`, 'i')), item.name);
  const quantity = screen.getByLabelText(new RegExp(`${row} quantity`, 'i'));
  await userEvent.clear(quantity);
  await userEvent.type(quantity, item.quantity);
  await userEvent.type(screen.getByLabelText(new RegExp(`${row} unit price`, 'i')), item.price);
};

const submit = () => userEvent.click(screen.getByRole('button', { name: /create order/i }));

describe('CreateOrderForm', () => {
  it('creates an order with several line items and reports its id', async () => {
    const onCreated = renderForm([
      {
        request: { query: CREATE_ORDER_MUTATION, variables: { input } },
        result: { data: { __typename: 'Mutation', createOrder: orderDetails({ id: 'new-order' }) } },
      },
    ]);

    await fillCustomer('Ada Lovelace', 'ada@example.com');
    await fillItem(0, { sku: 'TV-55', name: 'OLED TV', quantity: '1', price: '499' });
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    await fillItem(1, { sku: 'HDMI-2', name: 'HDMI cable', quantity: '2', price: '12.50' });
    expect(screen.getByText('€524.00')).toBeInTheDocument();
    await submit();

    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-order');
    });
  });

  it('shows client-side errors next to the fields and sends nothing', async () => {
    // No mocks: any request would fail the test with "No more mocked responses".
    const onCreated = renderForm([]);

    await userEvent.type(screen.getByLabelText(/email/i), 'nope');
    await submit();

    expect(screen.getByLabelText(/customer name/i)).toHaveAccessibleDescription('Name is required');
    expect(screen.getByLabelText(/email/i)).toHaveAccessibleDescription('Enter a valid email');
    expect(screen.getByLabelText(/item 1 sku/i)).toBeInvalid();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('removes a line item, but never the last one', async () => {
    renderForm([]);

    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /remove item 2/i }));

    expect(screen.queryByLabelText(/item 2 sku/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove item 1/i })).toBeDisabled();
  });

  it('shows server-side validation errors on the matching fields', async () => {
    const onCreated = renderForm([
      {
        request: {
          query: CREATE_ORDER_MUTATION,
          variables: {
            input: {
              customer: { name: 'Ada', email: 'ada@example' },
              lineItems: [{ sku: 'A', name: 'B', quantity: 1, unitPriceCents: 100 }],
            },
          },
        },
        result: {
          errors: [
            new GraphQLError('Invalid input', {
              extensions: {
                code: 'BAD_USER_INPUT',
                fields: [{ path: 'customer.email', messages: ['email must be an email'] }],
              },
            }),
          ],
        },
      },
    ]);

    await fillCustomer('Ada', 'ada@example');
    await fillItem(0, { sku: 'A', name: 'B', quantity: '1', price: '1' });
    await submit();

    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAccessibleDescription('email must be an email');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows other failures as a form-level alert', async () => {
    renderForm([
      {
        request: {
          query: CREATE_ORDER_MUTATION,
          variables: {
            input: {
              customer: { name: 'Ada', email: 'ada@example.com' },
              lineItems: [{ sku: 'A', name: 'B', quantity: 1, unitPriceCents: 100 }],
            },
          },
        },
        error: new Error('Failed to fetch'),
      },
    ]);

    await fillCustomer('Ada', 'ada@example.com');
    await fillItem(0, { sku: 'A', name: 'B', quantity: '1', price: '1' });
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to fetch/i);
  });
});
