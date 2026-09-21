import type { OrdersQuery } from '../gql/graphql';

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
