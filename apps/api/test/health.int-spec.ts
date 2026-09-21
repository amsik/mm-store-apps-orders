import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../src/core/di/tokens.js';
import { createTestApp } from './setup/create-test-app.js';
import { testConfig } from './setup/test-config.js';

const HEALTH_QUERY = '{ health { status db } }';

describe('health (integration)', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports the database as UP when MongoDB is reachable', async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer()).post('/graphql').send({ query: HEALTH_QUERY }).expect(200);

    expect(res.body).toEqual({ data: { health: { status: 'OK', db: 'UP' } } });
  });

  it('reports the database as DOWN, without failing the query, when MongoDB is unreachable', async () => {
    // Nothing listens on port 1; the short server selection timeout keeps the test fast.
    const unreachable = testConfig({
      databaseUrl: 'mongodb://127.0.0.1:1/orders?directConnection=true&serverSelectionTimeoutMS=200',
    });
    app = await createTestApp((builder) => builder.overrideProvider(APP_CONFIG).useValue(unreachable));

    const res = await request(app.getHttpServer()).post('/graphql').send({ query: HEALTH_QUERY }).expect(200);

    expect(res.body).toEqual({ data: { health: { status: 'OK', db: 'DOWN' } } });
  });
});
