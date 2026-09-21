import { afterAll, beforeEach, inject } from 'vitest';
import { PrismaClient } from '@prisma/client';

/** A database per Vitest worker, so test files running in parallel never share data. */
function workerDatabaseUrl(): string {
  const url = new URL(inject('mongoUri'));
  url.pathname = `/orders-test-${process.env.VITEST_POOL_ID ?? '0'}`;
  return url.toString();
}

export const testDatabaseUrl = workerDatabaseUrl();

// Read by ConfigModule when AppModule is imported, which happens after this setup file runs.
process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });

interface ListCollectionsResult {
  cursor: { firstBatch: { name: string }[] };
}

/** Empties every collection but keeps them (and their indexes) in place. */
async function resetDatabase(): Promise<void> {
  const result = (await prisma.$runCommandRaw({
    listCollections: 1,
    nameOnly: true,
  })) as unknown as ListCollectionsResult;
  for (const { name } of result.cursor.firstBatch) {
    await prisma.$runCommandRaw({ delete: name, deletes: [{ q: {}, limit: 0 }] });
  }
}

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});
