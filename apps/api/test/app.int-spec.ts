import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { AppConfig } from '../src/core/config/app-config.js';
import { APP_CONFIG } from '../src/core/di/tokens.js';

describe('AppModule (integration)', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('answers the health query over /graphql', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<Server>>());
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health { status } }' })
      .expect(200);

    expect(res.body).toEqual({ data: { health: { status: 'OK' } } });
  });

  it('lets tests swap the APP_CONFIG binding through the container', async () => {
    const testConfig: AppConfig = { nodeEnv: 'test', port: 0, logLevel: 'silent' };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<Server>>());
    await app.init();

    expect(app.get(APP_CONFIG)).toBe(testConfig);
    await request(app.getHttpServer()).post('/graphql').send({ query: '{ health { status } }' }).expect(200);
  });
});
