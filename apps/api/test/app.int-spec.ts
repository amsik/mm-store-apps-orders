import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../src/core/config/app-config.js';
import { APP_CONFIG } from '../src/core/di/tokens.js';
import { createTestApp } from './setup/create-test-app.js';
import { testDatabaseUrl } from './setup/database.js';

describe('AppModule (integration)', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('answers the health query over /graphql', async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health { status } }' })
      .expect(200);

    expect(res.body).toEqual({ data: { health: { status: 'OK' } } });
  });

  it('lets tests swap the APP_CONFIG binding through the container', async () => {
    const testConfig: AppConfig = {
      nodeEnv: 'test',
      port: 0,
      logLevel: 'silent',
      databaseUrl: testDatabaseUrl,
    };
    app = await createTestApp((builder) => builder.overrideProvider(APP_CONFIG).useValue(testConfig));

    expect(app.get(APP_CONFIG)).toBe(testConfig);
    await request(app.getHttpServer()).post('/graphql').send({ query: '{ health { status } }' }).expect(200);
  });
});
