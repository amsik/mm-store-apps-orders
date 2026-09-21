import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { GraphQLError } from 'graphql';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createCache } from '../apollo';
import type { OrdersQuery } from '../gql/graphql';
import { orderNode, ordersPage } from '../test/fixtures';
import { ORDERS_PAGE_SIZE, ORDERS_QUERY } from './documents';
import { OrdersList } from './OrdersList';

const ordersMock = (
  variables: { filter?: { state: 'OPEN' | 'IN_PROGRESS' | 'COMPLETE' }; after?: string },
  result: MockLink.MockedResponse<OrdersQuery>['result'],
): MockLink.MockedResponse<OrdersQuery> => ({
  request: { query: ORDERS_QUERY, variables: { first: ORDERS_PAGE_SIZE, ...variables } },
  result,
});

const renderList = (mocks: MockLink.MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks} cache={createCache()}>
      <OrdersList />
    </MockedProvider>,
  );

describe('OrdersList', () => {
  it('shows a loading state, then one row per order with customer, state and total', async () => {
    renderList([
      ordersMock(
        {},
        {
          data: ordersPage([
            orderNode(),
            orderNode({
              id: '665f00000000000000000002',
              state: 'IN_PROGRESS',
              customer: { __typename: 'Customer', name: 'Grace Hopper' },
              assignedEmployee: { __typename: 'Employee', id: 'e1', name: 'Linus' },
            }),
          ]),
        },
      ),
    ]);

    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();

    const ada = await screen.findByRole('row', { name: /ada lovelace/i });
    expect(within(ada).getByText('OPEN')).toBeInTheDocument();
    expect(within(ada).getByText('€499.00')).toBeInTheDocument();
    const grace = screen.getByRole('row', { name: /grace hopper/i });
    expect(within(grace).getByText('IN PROGRESS')).toBeInTheDocument();
    expect(within(grace).getByText('Linus')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no orders', async () => {
    renderList([ordersMock({}, { data: ordersPage([]) })]);

    expect(await screen.findByText(/no orders/i)).toBeInTheDocument();
  });

  it('shows a readable message when the API returns an error', async () => {
    renderList([ordersMock({}, { errors: [new GraphQLError('Database is unreachable')] })]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/database is unreachable/i);
  });

  it('shows a readable message when the API cannot be reached', async () => {
    renderList([
      {
        request: { query: ORDERS_QUERY, variables: { first: ORDERS_PAGE_SIZE } },
        error: new Error('Failed to fetch'),
      },
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to fetch/i);
  });

  it('refetches with the selected state filter', async () => {
    renderList([
      ordersMock({}, { data: ordersPage([orderNode()]) }),
      ordersMock(
        { filter: { state: 'COMPLETE' } },
        {
          data: ordersPage([
            orderNode({
              id: '665f00000000000000000009',
              state: 'COMPLETE',
              customer: { __typename: 'Customer', name: 'Alan Turing' },
            }),
          ]),
        },
      ),
    ]);
    await screen.findByRole('row', { name: /ada lovelace/i });

    await userEvent.selectOptions(screen.getByLabelText(/state/i), 'COMPLETE');

    expect(await screen.findByRole('row', { name: /alan turing/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /ada lovelace/i })).not.toBeInTheDocument();
  });

  it('appends the next page on "Load more" and hides the button on the last page', async () => {
    const first = orderNode();
    const second = orderNode({
      id: '665f00000000000000000000',
      customer: { __typename: 'Customer', name: 'Grace Hopper' },
    });
    renderList([
      ordersMock({}, { data: ordersPage([first], true) }),
      ordersMock({ after: first.id }, { data: ordersPage([second]) }),
    ]);

    await userEvent.click(await screen.findByRole('button', { name: /load more/i }));

    expect(await screen.findByRole('row', { name: /grace hopper/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /ada lovelace/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});
