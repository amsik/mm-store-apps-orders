import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../src/core/config/app-config.js';
import { APP_CONFIG, ORDER_REPOSITORY } from '../src/core/di/tokens.js';
import { loggerParams } from '../src/core/logging/logging.module.js';
import { createTestApp } from './setup/create-test-app.js';
import { testConfig } from './setup/test-config.js';

const ORDER_ID = '66f0c0ffee0000000000abcd';

interface LogLine {
  level: number;
  msg: string;
  requestId?: string;
  err?: { message: string };
}

interface GraphQLResponse {
  data?: unknown;
  errors: { extensions: { code: string } }[];
}

/** A pino destination that keeps every JSON log line in memory. */
function captureLogs() {
  const lines: LogLine[] = [];
  return {
    lines,
    stream: {
      write(chunk: string) {
        lines.push(JSON.parse(chunk) as LogLine);
      },
    },
  };
}

describe('API hardening (integration)', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const withConfig = (config: AppConfig) =>
    createTestApp((builder) => builder.overrideProvider(APP_CONFIG).useValue(config));

  const server = () => {
    if (!app) throw new Error('Start the app first');
    return app.getHttpServer();
  };

  const graphql = (query: string) => request(server()).post('/graphql').send({ query });

  describe('unexpected errors', () => {
    it('are masked in production and logged together with the request id', async () => {
      const config = testConfig({ nodeEnv: 'production', logLevel: 'info' });
      const logs = captureLogs();
      app = await createTestApp((builder) =>
        builder
          .overrideProvider(APP_CONFIG)
          .useValue(config)
          .overrideProvider(PARAMS_PROVIDER_TOKEN)
          .useValue(loggerParams(config, logs.stream))
          .overrideProvider(ORDER_REPOSITORY)
          .useValue({
            findById: () => Promise.reject(new Error('mongodb://admin:s3cret@db exploded')),
          }),
      );

      const res = await graphql(`{ order(id: "${ORDER_ID}") { id } }`).expect(200);

      const requestId = res.headers['x-request-id'];
      expect(requestId).toEqual(expect.any(String));
      expect(res.body).toEqual({
        data: null,
        errors: [
          {
            message: 'Internal server error',
            locations: [{ line: 1, column: 3 }],
            path: ['order'],
            extensions: { code: 'INTERNAL_SERVER_ERROR', requestId },
          },
        ],
      });
      expect(res.text).not.toMatch(/s3cret|exploded|stacktrace/);

      const logged = logs.lines.find((line) => line.msg === 'Unhandled error');
      expect(logged).toMatchObject({ level: 50, requestId });
      expect(logged?.err?.message).toMatch(/exploded/);
    });
  });

  describe('request id', () => {
    it('is generated for every request and echoed in x-request-id', async () => {
      app = await withConfig(testConfig());

      const res = await graphql('{ health { status } }').expect(200);

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses a well-formed x-request-id sent by the client', async () => {
      app = await withConfig(testConfig());

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('x-request-id', 'web-42')
        .send({ query: '{ health { status } }' })
        .expect(200);

      expect(res.headers['x-request-id']).toBe('web-42');
    });
  });

  describe('query depth limit', () => {
    const DEEP = '{ orders { nodes { assignedEmployee { id } } } }';

    it('rejects a query deeper than the limit before executing it', async () => {
      app = await withConfig(testConfig({ graphqlMaxDepth: 2 }));

      const res = await graphql(DEEP).expect(400);
      const body = res.body as GraphQLResponse;

      expect(body.data).toBeUndefined();
      expect(body.errors[0]?.extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });

    it('runs the same query when it fits within the limit', async () => {
      app = await withConfig(testConfig({ graphqlMaxDepth: 4 }));

      const res = await graphql(DEEP).expect(200);

      expect(res.body).toEqual({ data: { orders: { nodes: [] } } });
    });
  });

  it('rejects a request body over the size limit with 413', async () => {
    app = await withConfig(testConfig());

    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `{ health { status } } # ${'x'.repeat(200 * 1024)}` })
      .expect(413);
  });

  describe('CORS', () => {
    const preflight = (origin: string) =>
      request(server())
        .options('/graphql')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

    it('allows the configured origins', async () => {
      app = await withConfig(testConfig({ corsOrigins: ['http://localhost:5173'] }));

      const res = await preflight('http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('does not allow any other origin', async () => {
      app = await withConfig(testConfig({ corsOrigins: ['http://localhost:5173'] }));

      const res = await preflight('https://evil.example.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('introspection and GraphiQL', () => {
    const INTROSPECTION = '{ __schema { queryType { name } } }';
    const graphiql = () => request(server()).get('/graphql').set('Accept', 'text/html');

    it('are available when enabled', async () => {
      app = await withConfig(testConfig({ graphqlIntrospection: true }));

      const res = await graphql(INTROSPECTION).expect(200);
      const page = await graphiql();

      expect(res.body).toEqual({ data: { __schema: { queryType: { name: 'Query' } } } });
      expect(page.status).toBe(200);
      expect(page.text).toMatch(/graphiql/i);
    });

    it('are both turned off when disabled', async () => {
      app = await withConfig(testConfig({ graphqlIntrospection: false }));

      const res = await graphql(INTROSPECTION).expect(400);
      const page = await graphiql();

      expect((res.body as GraphQLResponse).errors[0]?.extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
      expect(page.text).not.toMatch(/graphiql/i);
    });
  });
});
