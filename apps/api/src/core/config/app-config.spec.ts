import { describe, expect, it } from 'vitest';
import { InvalidConfigError, validateEnv } from './app-config.js';

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(validateEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('keeps unrelated variables out of the validated config', () => {
    expect(validateEnv({ PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('rejects invalid values and lists every offending key', () => {
    const act = () => validateEnv({ NODE_ENV: 'staging', PORT: 'abc', LOG_LEVEL: 'info' });

    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/NODE_ENV/);
    expect(act).toThrow(/PORT/);
    expect(act).not.toThrow(/LOG_LEVEL/);
  });

  it('rejects a PORT outside the TCP range', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow(/PORT/);
  });
});
