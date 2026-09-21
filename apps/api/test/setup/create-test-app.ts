import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/**
 * Boots the real `AppModule` graph with the same pipeline as `main.ts`. `customize` receives the
 * builder so a test can swap bindings (`overrideProvider`) before the container is compiled.
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication<Server>> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = configureApp(moduleRef.createNestApplication<INestApplication<Server>>());
  await app.init();
  return app;
}
