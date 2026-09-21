import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './setup/create-test-app.js';
import { testDatabaseUrl } from './setup/database.js';

const ORDER_FIELDS = `
  id
  state
  customer { name email }
  lineItems { sku name quantity unitPriceCents }
  createdAt
  updatedAt
`;

const CREATE_ORDER = `
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

const GET_ORDER = `
  query Order($id: ID!) {
    order(id: $id) { ${ORDER_FIELDS} }
  }
`;

const LIST_ORDERS = `
  query Orders($filter: OrderFilter, $first: Int, $after: ID) {
    orders(filter: $filter, first: $first, after: $after) {
      nodes { id state }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

interface OrderConnection {
  nodes: { id: string; state: string }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

const VALID_INPUT = {
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  lineItems: [
    { sku: 'TV-55', name: 'Television 55"', quantity: 1, unitPriceCents: 49_900 },
    { sku: 'HDMI-2', name: 'HDMI cable', quantity: 2, unitPriceCents: 1_299 },
  ],
};

interface GraphQLResponse {
  data?: Record<string, unknown> | null;
  errors?: {
    message: string;
    extensions: { code: string; fields?: { path: string; messages: string[] }[] };
  }[];
}

describe('orders (integration)', () => {
  let app: INestApplication<Server>;
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function gql(query: string, variables: object): Promise<GraphQLResponse> {
    const res = await request(app.getHttpServer()).post('/graphql').send({ query, variables });
    return res.body as GraphQLResponse;
  }

  describe('createOrder', () => {
    it('creates an OPEN order with timestamps, customer and line items', async () => {
      const res = await gql(CREATE_ORDER, { input: VALID_INPUT });

      expect(res.errors).toBeUndefined();
      const order = res.data?.createOrder as Record<string, unknown>;
      expect(order).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/) as string,
        state: 'OPEN',
        customer: VALID_INPUT.customer,
        lineItems: VALID_INPUT.lineItems,
        createdAt: expect.any(String) as string,
        updatedAt: order.createdAt,
      });
      expect(new Date(order.createdAt as string).toISOString()).toBe(order.createdAt);
    });

    it.each([
      ['no line items', { ...VALID_INPUT, lineItems: [] }, 'lineItems'],
      [
        'quantity 0',
        { ...VALID_INPUT, lineItems: [{ ...VALID_INPUT.lineItems[0], quantity: 0 }] },
        'lineItems.0.quantity',
      ],
      [
        'a negative price',
        { ...VALID_INPUT, lineItems: [{ ...VALID_INPUT.lineItems[0], unitPriceCents: -1 }] },
        'lineItems.0.unitPriceCents',
      ],
      [
        'a bad email',
        { ...VALID_INPUT, customer: { ...VALID_INPUT.customer, email: 'nope' } },
        'customer.email',
      ],
    ])('rejects %s with BAD_USER_INPUT and persists nothing', async (_case, input, path) => {
      const res = await gql(CREATE_ORDER, { input });

      expect(res.data).toBeNull();
      expect(res.errors).toHaveLength(1);
      expect(res.errors?.[0]?.extensions).toMatchObject({
        code: 'BAD_USER_INPUT',
        fields: [{ path, messages: [expect.any(String)] }],
      });
      expect(await prisma.order.count()).toBe(0);
    });
  });

  describe('order', () => {
    it('returns the order that was created', async () => {
      const created = (await gql(CREATE_ORDER, { input: VALID_INPUT })).data?.createOrder as { id: string };

      const res = await gql(GET_ORDER, { id: created.id });

      expect(res).toEqual({ data: { order: created } });
    });

    it('returns NOT_FOUND for an unknown id', async () => {
      const res = await gql(GET_ORDER, { id: '665f1c2b8a1e4d0012345678' });

      expect(res.data).toBeNull();
      expect(res.errors?.[0]).toMatchObject({
        message: 'Order 665f1c2b8a1e4d0012345678 not found',
        extensions: { code: 'NOT_FOUND' },
      });
    });

    it('returns BAD_USER_INPUT for a malformed id', async () => {
      const res = await gql(GET_ORDER, { id: 'not-an-object-id' });

      expect(res.data).toBeNull();
      expect(res.errors?.[0]?.extensions).toMatchObject({
        code: 'BAD_USER_INPUT',
        fields: [{ path: 'id', messages: [expect.any(String)] }],
      });
    });
  });

  describe('orders', () => {
    /** Creates `count` orders oldest first and returns their ids newest first. */
    async function seed(count: number): Promise<string[]> {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const res = await gql(CREATE_ORDER, { input: VALID_INPUT });
        ids.unshift((res.data?.createOrder as { id: string }).id);
      }
      return ids;
    }

    async function list(variables: object): Promise<OrderConnection> {
      const res = await gql(LIST_ORDERS, variables);
      expect(res.errors).toBeUndefined();
      return res.data?.orders as OrderConnection;
    }

    it('returns all orders newest first when no filter is given', async () => {
      const ids = await seed(3);

      expect(await list({})).toEqual({
        nodes: ids.map((id) => ({ id, state: 'OPEN' })),
        pageInfo: { endCursor: ids[2], hasNextPage: false },
      });
    });

    it('returns an empty connection when no order matches', async () => {
      await seed(2);

      expect(await list({ filter: { state: 'COMPLETE' } })).toEqual({
        nodes: [],
        pageInfo: { endCursor: null, hasNextPage: false },
      });
    });

    it('filters by state', async () => {
      const [open] = await seed(1);
      const [inProgress] = await seed(1);
      await prisma.order.update({ where: { id: inProgress }, data: { state: 'IN_PROGRESS' } });

      expect((await list({ filter: { state: 'IN_PROGRESS' } })).nodes).toEqual([
        { id: inProgress, state: 'IN_PROGRESS' },
      ]);
      expect((await list({ filter: { state: 'OPEN' } })).nodes).toEqual([{ id: open, state: 'OPEN' }]);
    });

    it('pages through 25 orders 10 at a time with no duplicates or gaps', async () => {
      const ids = await seed(25);

      const first = await list({ first: 10 });
      const second = await list({ first: 10, after: first.pageInfo.endCursor });
      const third = await list({ first: 10, after: second.pageInfo.endCursor });

      const pages = [first, second, third];
      expect(pages.map((page) => page.nodes.length)).toEqual([10, 10, 5]);
      expect(pages.map((page) => page.pageInfo.hasNextPage)).toEqual([true, true, false]);
      expect(pages.flatMap((page) => page.nodes.map((node) => node.id))).toEqual(ids);
    });

    it.each([
      ['first 0', { first: 0 }, 'first'],
      ['first above 100', { first: 101 }, 'first'],
      ['a malformed cursor', { after: 'not-a-cursor' }, 'after'],
    ])('rejects %s with BAD_USER_INPUT', async (_case, variables, path) => {
      const res = await gql(LIST_ORDERS, variables);

      expect(res.data).toBeNull();
      expect(res.errors?.[0]?.extensions).toMatchObject({
        code: 'BAD_USER_INPUT',
        fields: [{ path, messages: [expect.any(String)] }],
      });
    });
  });
});
