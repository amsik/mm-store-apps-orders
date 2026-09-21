import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

// Same major/minor as docker-compose and Atlas, so tests exercise the server version we run in production.
const MONGO_VERSION = '8.0.32';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** Vitest global setup: one single-node replica set for the whole run, stopped in teardown. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const replSet = await MongoMemoryReplSet.create({
    binary: { version: MONGO_VERSION },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  project.provide('mongoUri', replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
