import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const TRANSITION_ORDER = `
  mutation TransitionOrder($input: TransitionOrderInput!) {
    transitionOrder(input: $input) {
      id
      state
      assignedEmployee { id name }
      history { from to at employeeId }
      createdAt
      updatedAt
    }
  }
`;

interface TransitionedOrder {
  id: string;
  state: string;
  assignedEmployee: { id: string; name: string } | null;
  history: { from: string; to: string; at: string; employeeId: string | null }[];
  createdAt: string;
  updatedAt: string;
}

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
    extensions: {
      code: string;
      fields?: { path: string; messages: string[] }[];
      from?: string;
      to?: string;
    };
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

  describe('transitionOrder', () => {
    const ALICE = { id: '66f0e0000000000000000001', name: 'Alice Schmidt' };
    const BRUNO = { id: '66f0e0000000000000000002', name: 'Bruno Weber' };
    const UNKNOWN_ID = '665f1c2b8a1e4d0012345678';

    let orderId: string;

    beforeEach(async () => {
      await prisma.employee.createMany({ data: [ALICE, BRUNO] });
      orderId = ((await gql(CREATE_ORDER, { input: VALID_INPUT })).data?.createOrder as { id: string }).id;
    });

    function transition(input: object): Promise<GraphQLResponse> {
      return gql(TRANSITION_ORDER, { input: { orderId, ...input } });
    }

    async function transitioned(input: object): Promise<TransitionedOrder> {
      const res = await transition(input);
      expect(res.errors).toBeUndefined();
      return res.data?.transitionOrder as TransitionedOrder;
    }

    /** The stored order, to prove a rejected transition changed nothing. */
    function stored() {
      return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    }

    it('moves an order OPEN → IN_PROGRESS → COMPLETE, keeping the employee and recording history', async () => {
      const created = await stored();

      const started = await transitioned({ targetState: 'IN_PROGRESS', employeeId: ALICE.id });
      expect(started).toMatchObject({ id: orderId, state: 'IN_PROGRESS', assignedEmployee: ALICE });
      expect(new Date(started.updatedAt) > created.updatedAt).toBe(true);

      const completed = await transitioned({ targetState: 'COMPLETE' });
      expect(completed).toMatchObject({ state: 'COMPLETE', assignedEmployee: ALICE });
      expect(completed.updatedAt >= started.updatedAt).toBe(true);
      expect(completed.history).toEqual([
        { from: 'OPEN', to: 'IN_PROGRESS', at: started.updatedAt, employeeId: ALICE.id },
        { from: 'IN_PROGRESS', to: 'COMPLETE', at: completed.updatedAt, employeeId: ALICE.id },
      ]);

      expect(await gql(GET_ORDER, { id: orderId })).toMatchObject({ data: { order: { state: 'COMPLETE' } } });
    });

    it('returns an OPEN order with no employee and an empty history', async () => {
      const res = await gql(
        `query ($id: ID!) { order(id: $id) { assignedEmployee { id } history { to } } }`,
        {
          id: orderId,
        },
      );

      expect(res).toEqual({ data: { order: { assignedEmployee: null, history: [] } } });
    });

    describe('rejections change nothing', () => {
      it.each([
        ['a skip (OPEN → COMPLETE)', { targetState: 'COMPLETE' }, 'INVALID_TRANSITION'],
        ['a repeat (OPEN → OPEN)', { targetState: 'OPEN' }, 'INVALID_TRANSITION'],
        ['IN_PROGRESS without an employee', { targetState: 'IN_PROGRESS' }, 'EMPLOYEE_REQUIRED'],
        [
          'IN_PROGRESS with an unknown employee',
          { targetState: 'IN_PROGRESS', employeeId: UNKNOWN_ID },
          'NOT_FOUND',
        ],
      ])('rejects %s with %s', async (_case, input, code) => {
        const before = await stored();

        const res = await transition(input);

        expect(res.data).toBeNull();
        expect(res.errors).toHaveLength(1);
        expect(res.errors?.[0]?.extensions.code).toBe(code);
        expect(await stored()).toEqual(before);
      });

      it('rejects a revert (IN_PROGRESS → OPEN) with INVALID_TRANSITION, naming both states', async () => {
        await transitioned({ targetState: 'IN_PROGRESS', employeeId: ALICE.id });
        const before = await stored();

        const res = await transition({ targetState: 'OPEN' });

        expect(res.errors?.[0]).toMatchObject({
          message: 'Cannot move an order from IN_PROGRESS to OPEN; the next state must be COMPLETE',
          extensions: { code: 'INVALID_TRANSITION', from: 'IN_PROGRESS', to: 'OPEN' },
        });
        expect(await stored()).toEqual(before);
      });

      it('rejects any move out of COMPLETE with INVALID_TRANSITION', async () => {
        await transitioned({ targetState: 'IN_PROGRESS', employeeId: ALICE.id });
        await transitioned({ targetState: 'COMPLETE' });
        const before = await stored();

        const res = await transition({ targetState: 'IN_PROGRESS', employeeId: BRUNO.id });

        expect(res.errors?.[0]?.extensions.code).toBe('INVALID_TRANSITION');
        expect(await stored()).toEqual(before);
      });

      it('rejects an unknown order with NOT_FOUND', async () => {
        const res = await gql(TRANSITION_ORDER, {
          input: { orderId: UNKNOWN_ID, targetState: 'IN_PROGRESS', employeeId: ALICE.id },
        });

        expect(res.errors?.[0]).toMatchObject({
          message: `Order ${UNKNOWN_ID} not found`,
          extensions: { code: 'NOT_FOUND' },
        });
      });

      it.each([
        ['orderId', { orderId: 'nope', targetState: 'COMPLETE' }],
        ['employeeId', { targetState: 'IN_PROGRESS', employeeId: 'nope' }],
      ])('rejects a malformed %s with BAD_USER_INPUT', async (path, input) => {
        const before = await stored();

        const res = await transition(input);

        expect(res.errors?.[0]?.extensions).toMatchObject({ code: 'BAD_USER_INPUT', fields: [{ path }] });
        expect(await stored()).toEqual(before);
      });
    });

    it('lets exactly one of two concurrent starts win', async () => {
      const results = await Promise.all([
        transition({ targetState: 'IN_PROGRESS', employeeId: ALICE.id }),
        transition({ targetState: 'IN_PROGRESS', employeeId: BRUNO.id }),
      ]);

      const winners = results.filter((res) => !res.errors);
      const losers = results.filter((res) => res.errors);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      // The loser either read the order before the winner wrote it (the write then matches nothing) or after.
      expect(['CONCURRENT_MODIFICATION', 'INVALID_TRANSITION']).toContain(
        losers[0]?.errors?.[0]?.extensions.code,
      );

      const order = await stored();
      const winner = winners[0]?.data?.transitionOrder as TransitionedOrder;
      expect(order.history).toHaveLength(1);
      expect(order.assignedEmployee).toEqual(winner.assignedEmployee);
    });
  });
});
