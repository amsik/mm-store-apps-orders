import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../src/core/di/tokens.js';
import { createTestApp } from './setup/create-test-app.js';
import { testConfig } from './setup/test-config.js';

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
    const config = testConfig();
    app = await createTestApp((builder) => builder.overrideProvider(APP_CONFIG).useValue(config));

    expect(app.get(APP_CONFIG)).toBe(config);
    await request(app.getHttpServer()).post('/graphql').send({ query: '{ health { status } }' }).expect(200);
  });
});
