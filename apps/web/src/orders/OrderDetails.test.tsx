import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { GraphQLError } from 'graphql';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createCache } from '../apollo';
import type { OrderDetailsFragment } from '../gql/graphql';
import { completeDetails, employees, inProgressDetails, orderDetails } from '../test/fixtures';
import { ORDER_QUERY, TRANSITION_ORDER_MUTATION } from './documents';
import { OrderDetails } from './OrderDetails';

const ORDER_ID = '665f00000000000000000001';

const orderMock = (order: OrderDetailsFragment): MockLink.MockedResponse => ({
  request: { query: ORDER_QUERY, variables: { id: ORDER_ID } },
  result: { data: { __typename: 'Query', order, employees } },
});

const transitionMock = (
  input: { targetState: 'IN_PROGRESS' | 'COMPLETE'; employeeId?: string },
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse => ({
  request: { query: TRANSITION_ORDER_MUTATION, variables: { input: { orderId: ORDER_ID, ...input } } },
  result,
});

const renderDetails = (mocks: MockLink.MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks} cache={createCache()}>
      <OrderDetails orderId={ORDER_ID} />
    </MockedProvider>,
  );

const stateOf = () => screen.getByTestId('order-state');

describe('OrderDetails', () => {
  it('shows the customer, line items and total', async () => {
    renderDetails([orderMock(orderDetails())]);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    const cables = screen.getByRole('row', { name: /hdmi cable/i });
    expect(within(cables).getByText('€12.50')).toBeInTheDocument();
    expect(within(cables).getByText('€25.00')).toBeInTheDocument();
    expect(screen.getByText('€524.00')).toBeInTheDocument();
    expect(stateOf()).toHaveTextContent('OPEN');
  });

  it('requires picking an employee before an OPEN order can be started', async () => {
    renderDetails([orderMock(orderDetails())]);

    const start = await screen.findByRole('button', { name: /start/i });
    expect(start).toBeDisabled();
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/employee/i), 'emp-2');
    expect(start).toBeEnabled();
  });

  it('starts the order with the picked employee and updates the view without a reload', async () => {
    const started = { ...inProgressDetails(), assignedEmployee: employees[1] ?? null };
    renderDetails([
      orderMock(orderDetails()),
      transitionMock(
        { targetState: 'IN_PROGRESS', employeeId: 'emp-2' },
        { data: { __typename: 'Mutation', transitionOrder: started } },
      ),
    ]);

    await userEvent.selectOptions(await screen.findByLabelText(/employee/i), 'emp-2');
    await userEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(await screen.findByRole('button', { name: /complete/i })).toBeInTheDocument();
    expect(stateOf()).toHaveTextContent('IN PROGRESS');
    expect(screen.getByTestId('assigned-employee')).toHaveTextContent('Bob Meier');
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument();
  });

  it('offers only "Complete" for an IN_PROGRESS order and completes it', async () => {
    renderDetails([
      orderMock(inProgressDetails()),
      transitionMock(
        { targetState: 'COMPLETE' },
        { data: { __typename: 'Mutation', transitionOrder: completeDetails() } },
      ),
    ]);

    await userEvent.click(await screen.findByRole('button', { name: /complete/i }));

    expect(await screen.findByText(/no further actions/i)).toBeInTheDocument();
    expect(stateOf()).toHaveTextContent('COMPLETE');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no actions for a COMPLETE order and lists its history with employee names', async () => {
    renderDetails([orderMock(completeDetails())]);

    expect(await screen.findByText(/no further actions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const history = screen.getAllByRole('listitem');
    expect(history).toHaveLength(2);
    expect(history[0]).toHaveTextContent(/OPEN → IN PROGRESS.*Alice Schmidt/);
    expect(history[1]).toHaveTextContent(/IN PROGRESS → COMPLETE/);
  });

  it('shows a rejected transition and then reflects the true server state', async () => {
    renderDetails([
      orderMock(inProgressDetails()),
      transitionMock(
        { targetState: 'COMPLETE' },
        {
          errors: [
            new GraphQLError('The order was modified by another request', {
              extensions: { code: 'CONCURRENT_MODIFICATION' },
            }),
          ],
        },
      ),
      // Another request completed the order in the meantime.
      orderMock(completeDetails()),
    ]);

    await userEvent.click(await screen.findByRole('button', { name: /complete/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/modified by another request/i);
    expect(await screen.findByText(/no further actions/i)).toBeInTheDocument();
    expect(stateOf()).toHaveTextContent('COMPLETE');
  });

  it('shows a readable message when the order does not exist', async () => {
    renderDetails([
      {
        request: { query: ORDER_QUERY, variables: { id: ORDER_ID } },
        result: { errors: [new GraphQLError('Order not found', { extensions: { code: 'NOT_FOUND' } })] },
      },
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/order not found/i);
  });
});
