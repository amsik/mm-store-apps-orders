import { describe, expect, it } from 'vitest';
import { InvalidConfigError, validateEnv } from './app-config.js';

const DATABASE_URL = 'mongodb://localhost:27017/mm-order?replicaSet=rs0&directConnection=true';

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL,
      CORS_ORIGINS: [],
      GRAPHQL_INTROSPECTION: true,
      GRAPHQL_MAX_DEPTH: 8,
    });
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('keeps unrelated variables out of the validated config', () => {
    expect(validateEnv({ DATABASE_URL, PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('rejects invalid values and lists every offending key', () => {
    const act = () => validateEnv({ DATABASE_URL, NODE_ENV: 'staging', PORT: 'abc', LOG_LEVEL: 'info' });

    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/NODE_ENV/);
    expect(act).toThrow(/PORT/);
    expect(act).not.toThrow(/LOG_LEVEL/);
  });

  it('rejects a PORT outside the TCP range', () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/PORT/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('accepts a mongodb+srv:// DATABASE_URL (Atlas)', () => {
    const url = 'mongodb+srv://user:pass@cluster0.example.mongodb.net/orders';
    expect(validateEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('rejects a DATABASE_URL that is not a MongoDB connection string', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgres://localhost/orders' })).toThrow(/DATABASE_URL/);
  });

  it('never echoes the DATABASE_URL value (it holds credentials) in the error', () => {
    const act = () => validateEnv({ DATABASE_URL: 'mysql://user:s3cret@db/orders' });
    expect(act).toThrow(/DATABASE_URL/);
    expect(act).not.toThrow(/s3cret/);
  });

  it('parses CORS_ORIGINS as a comma-separated list of origins', () => {
    expect(
      validateEnv({ DATABASE_URL, CORS_ORIGINS: 'http://localhost:5173, https://orders.example.com' })
        .CORS_ORIGINS,
    ).toEqual(['http://localhost:5173', 'https://orders.example.com']);
  });

  it('rejects a CORS origin that is not an http(s) URL', () => {
    expect(() => validateEnv({ DATABASE_URL, CORS_ORIGINS: 'localhost:5173' })).toThrow(/CORS_ORIGINS/);
  });

  it('turns introspection off by default in production only', () => {
    expect(validateEnv({ DATABASE_URL, NODE_ENV: 'production' }).GRAPHQL_INTROSPECTION).toBe(false);
    expect(validateEnv({ DATABASE_URL, NODE_ENV: 'test' }).GRAPHQL_INTROSPECTION).toBe(true);
  });

  it('lets GRAPHQL_INTROSPECTION override the default', () => {
    expect(
      validateEnv({ DATABASE_URL, NODE_ENV: 'production', GRAPHQL_INTROSPECTION: 'true' })
        .GRAPHQL_INTROSPECTION,
    ).toBe(true);
    expect(() => validateEnv({ DATABASE_URL, GRAPHQL_INTROSPECTION: 'maybe' })).toThrow(
      /GRAPHQL_INTROSPECTION/,
    );
  });

  it('requires GRAPHQL_MAX_DEPTH to be a positive integer', () => {
    expect(validateEnv({ DATABASE_URL, GRAPHQL_MAX_DEPTH: '5' }).GRAPHQL_MAX_DEPTH).toBe(5);
    expect(() => validateEnv({ DATABASE_URL, GRAPHQL_MAX_DEPTH: '0' })).toThrow(/GRAPHQL_MAX_DEPTH/);
  });
});
