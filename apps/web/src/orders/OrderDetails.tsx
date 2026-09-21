import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { ORDER_QUERY, TRANSITION_ORDER_MUTATION } from './documents';
import { formatCents, formatDateTime, formatState, orderTotalCents } from './format';

export function OrderDetails({ orderId }: { orderId: string }) {
  const { data, error, loading, refetch } = useQuery(ORDER_QUERY, { variables: { id: orderId } });
  const [transition, { loading: saving }] = useMutation(TRANSITION_ORDER_MUTATION);
  const [employeeId, setEmployeeId] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);

  if (loading) return <p>Loading order…</p>;
  if (error || !data) {
    return (
      <div role="alert" className="error">
        Could not load the order: {error?.message ?? 'no data'}
      </div>
    );
  }

  const { order, employees } = data;
  const employeeName = (id: string | null | undefined) =>
    employees.find((employee) => employee.id === id)?.name ?? id ?? '—';

  const moveTo = async (targetState: 'IN_PROGRESS' | 'COMPLETE') => {
    setTransitionError(null);
    try {
      await transition({
        variables: {
          input: { orderId, targetState, ...(targetState === 'IN_PROGRESS' && { employeeId }) },
        },
      });
    } catch (rejected) {
      // The server is the source of truth (e.g. another request won a race): show why, then show its state.
      setTransitionError(rejected instanceof Error ? rejected.message : String(rejected));
      await refetch();
    }
  };

  return (
    <article className="details">
      <h2>
        Order <code>{order.id}</code>{' '}
        <span data-testid="order-state" className={`badge badge-${order.state.toLowerCase()}`}>
          {formatState(order.state)}
        </span>
      </h2>

      <dl>
        <dt>Customer</dt>
        <dd>{order.customer.name}</dd>
        <dt>Email</dt>
        <dd>{order.customer.email}</dd>
        <dt>Employee</dt>
        <dd data-testid="assigned-employee">{order.assignedEmployee?.name ?? '—'}</dd>
        <dt>Created</dt>
        <dd>{formatDateTime(order.createdAt)}</dd>
        <dt>Updated</dt>
        <dd>{formatDateTime(order.updatedAt)}</dd>
      </dl>

      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">SKU</th>
            <th scope="col">Qty</th>
            <th scope="col">Unit price</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.lineItems.map((item) => (
            <tr key={item.sku}>
              <td>{item.name}</td>
              <td>{item.sku}</td>
              <td>{item.quantity}</td>
              <td>{formatCents(item.unitPriceCents)}</td>
              <td>{formatCents(item.quantity * item.unitPriceCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4}>
              Total
            </th>
            <td>{formatCents(orderTotalCents(order.lineItems))}</td>
          </tr>
        </tfoot>
      </table>

      {transitionError && (
        <div role="alert" className="error">
          {transitionError}
        </div>
      )}

      <section className="actions">
        {order.state === 'OPEN' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void moveTo('IN_PROGRESS');
            }}
          >
            <label>
              Employee{' '}
              <select
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                }}
              >
                <option value="">Pick an employee…</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>{' '}
            <button type="submit" disabled={!employeeId || saving}>
              Start
            </button>
          </form>
        )}
        {order.state === 'IN_PROGRESS' && (
          <button type="button" disabled={saving} onClick={() => void moveTo('COMPLETE')}>
            Complete
          </button>
        )}
        {order.state === 'COMPLETE' && <p>This order is complete. No further actions.</p>}
      </section>

      <h3>History</h3>
      {order.history.length === 0 ? (
        <p>No transitions yet.</p>
      ) : (
        <ol className="history">
          {order.history.map((change) => (
            <li key={change.at}>
              {formatState(change.from)} → {formatState(change.to)} · {formatDateTime(change.at)} ·{' '}
              {employeeName(change.employeeId)}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
