import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './setup/database.js';

// These two tests are order-dependent on purpose: they prove that the harness empties the database
// between tests, which every other integration test relies on.
describe('integration test harness', () => {
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('writes to the per-worker replica set database', async () => {
    await prisma.employee.create({ data: { name: 'Ada' } });

    expect(await prisma.employee.count()).toBe(1);
  });

  it('starts every test with an empty database', async () => {
    expect(await prisma.employee.count()).toBe(0);
  });
});
