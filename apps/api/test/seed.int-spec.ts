import { PrismaClient } from '@prisma/client';
import { afterAll, assert, describe, expect, it } from 'vitest';
import { SEED_EMPLOYEES, SEED_ORDERS, seed } from '../prisma/seed.js';
import { testDatabaseUrl } from './setup/database.js';

describe('seed (integration)', () => {
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('inserts the sample employees and orders', async () => {
    await seed(prisma);

    expect(await prisma.employee.findMany({ orderBy: { id: 'asc' } })).toEqual(
      [...SEED_EMPLOYEES].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await prisma.order.count()).toBe(SEED_ORDERS.length);
  });

  it('is idempotent: running it twice creates no duplicates', async () => {
    await seed(prisma);
    await seed(prisma);

    expect(await prisma.employee.count()).toBe(SEED_EMPLOYEES.length);
    expect(await prisma.order.count()).toBe(SEED_ORDERS.length);
  });

  it('leaves orders that already exist untouched', async () => {
    await seed(prisma);
    const [order] = SEED_ORDERS;
    assert(order);
    await prisma.order.update({ where: { id: order.id }, data: { state: 'IN_PROGRESS' } });

    await seed(prisma);

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      state: 'IN_PROGRESS',
    });
  });
});
