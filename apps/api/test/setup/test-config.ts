import type { AppConfig } from '../../src/core/config/app-config.js';
import { testDatabaseUrl } from './database.js';

/** A complete `AppConfig` for tests that bind `APP_CONFIG` themselves; override only what the test is about. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    logLevel: 'silent',
    databaseUrl: testDatabaseUrl,
    corsOrigins: [],
    graphqlIntrospection: true,
    graphqlMaxDepth: 8,
    ...overrides,
  };
}
