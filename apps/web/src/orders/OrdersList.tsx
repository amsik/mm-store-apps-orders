import { NetworkStatus } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import type { OrderState } from '../gql/graphql';
import { orderHref } from '../router';
import { ORDERS_PAGE_SIZE, ORDERS_QUERY } from './documents';
import { formatCents, formatDateTime, formatState, orderTotalCents } from './format';

const STATES: OrderState[] = ['OPEN', 'IN_PROGRESS', 'COMPLETE'];

export function OrdersList() {
  const [state, setState] = useState<OrderState | ''>('');
  const { data, error, loading, networkStatus, fetchMore, refetch } = useQuery(ORDERS_QUERY, {
    variables: { first: ORDERS_PAGE_SIZE, ...(state && { filter: { state } }) },
    // Show the cached list at once, but pick up transitions made on the details screen.
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });
  const orders = data?.orders;
  const loadingMore = networkStatus === NetworkStatus.fetchMore;

  return (
    <section>
      <div className="toolbar">
        <label>
          State{' '}
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value as OrderState | '');
            }}
          >
            <option value="">All</option>
            {STATES.map((value) => (
              <option key={value} value={value}>
                {formatState(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="error">
          Could not load orders: {error.message}{' '}
          <button type="button" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {loading && !loadingMore && <p>Loading orders…</p>}

      {orders && !loading && orders.nodes.length === 0 && <p>No orders found.</p>}

      {orders && orders.nodes.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">State</th>
              <th scope="col">Employee</th>
              <th scope="col">Items</th>
              <th scope="col">Total</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.nodes.map((order) => (
              <tr key={order.id}>
                <td>
                  <a href={orderHref(order.id)}>{order.customer.name}</a>
                </td>
                <td>
                  <span className={`badge badge-${order.state.toLowerCase()}`}>
                    {formatState(order.state)}
                  </span>
                </td>
                <td>{order.assignedEmployee?.name ?? '—'}</td>
                <td>{order.lineItems.reduce((count, item) => count + item.quantity, 0)}</td>
                <td>{formatCents(orderTotalCents(order.lineItems))}</td>
                <td>{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {orders?.pageInfo.hasNextPage && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void fetchMore({ variables: { after: orders.pageInfo.endCursor } })}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  );
}
