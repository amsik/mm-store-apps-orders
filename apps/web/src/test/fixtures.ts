import type { OrderDetailsFragment, OrdersQuery } from '../gql/graphql';

type OrderNode = OrdersQuery['orders']['nodes'][number];

export const orderNode = (overrides: Partial<OrderNode> = {}): OrderNode => ({
  __typename: 'Order',
  id: '665f00000000000000000001',
  state: 'OPEN',
  createdAt: '2026-09-21T10:00:00.000Z',
  customer: { __typename: 'Customer', name: 'Ada Lovelace' },
  lineItems: [{ __typename: 'LineItem', sku: 'TV-55', quantity: 1, unitPriceCents: 49900 }],
  assignedEmployee: null,
  ...overrides,
});

export const ordersPage = (nodes: OrderNode[], hasNextPage = false): OrdersQuery => ({
  __typename: 'Query',
  orders: {
    __typename: 'OrderConnection',
    nodes,
    pageInfo: { __typename: 'PageInfo', endCursor: nodes.at(-1)?.id ?? null, hasNextPage },
  },
});

export const employees = [
  { __typename: 'Employee' as const, id: 'emp-1', name: 'Alice Schmidt' },
  { __typename: 'Employee' as const, id: 'emp-2', name: 'Bob Meier' },
];

export const orderDetails = (overrides: Partial<OrderDetailsFragment> = {}): OrderDetailsFragment => ({
  __typename: 'Order',
  id: '665f00000000000000000001',
  state: 'OPEN',
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
  customer: { __typename: 'Customer', name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [
    { __typename: 'LineItem', sku: 'TV-55', name: 'OLED TV 55"', quantity: 1, unitPriceCents: 49900 },
    { __typename: 'LineItem', sku: 'HDMI-2', name: 'HDMI cable', quantity: 2, unitPriceCents: 1250 },
  ],
  assignedEmployee: null,
  history: [],
  ...overrides,
});

const startedAt = '2026-09-21T11:00:00.000Z';

export const inProgressDetails = (): OrderDetailsFragment =>
  orderDetails({
    state: 'IN_PROGRESS',
    updatedAt: startedAt,
    assignedEmployee: employees[0] ?? null,
    history: [
      { __typename: 'OrderStateChange', from: 'OPEN', to: 'IN_PROGRESS', at: startedAt, employeeId: 'emp-1' },
    ],
  });

export const completeDetails = (): OrderDetailsFragment => {
  const order = inProgressDetails();
  const completedAt = '2026-09-21T12:00:00.000Z';
  return {
    ...order,
    state: 'COMPLETE',
    updatedAt: completedAt,
    history: [
      ...order.history,
      {
        __typename: 'OrderStateChange',
        from: 'IN_PROGRESS',
        to: 'COMPLETE',
        at: completedAt,
        employeeId: 'emp-1',
      },
    ],
  };
};
