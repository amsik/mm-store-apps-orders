import { z } from 'zod';

const origin = z.url({ protocol: /^https?$/, error: 'must be a comma-separated list of http(s) origins' });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Prisma on MongoDB needs a replica set: `?replicaSet=rs0&directConnection=true` locally, Atlas SRV in prod.
    // The custom message keeps the value (which carries credentials) out of the boot error.
    DATABASE_URL: z
      .string({ error: 'is required' })
      .regex(/^mongodb(\+srv)?:\/\//, { error: 'must be a mongodb:// or mongodb+srv:// connection string' }),
    // Browser origins allowed to call the API; empty means no cross-origin access.
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .pipe(z.array(origin)),
    // Schema introspection and the GraphiQL page; off in production unless set explicitly.
    GRAPHQL_INTROSPECTION: z.stringbool().optional(),
    GRAPHQL_MAX_DEPTH: z.coerce.number().int().min(1).default(8),
  })
  .transform((env) => ({
    ...env,
    GRAPHQL_INTROSPECTION: env.GRAPHQL_INTROSPECTION ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.output<typeof envSchema>;

/** The typed configuration that the rest of the app injects through the `APP_CONFIG` token. */
export interface AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly port: number;
  readonly logLevel: Env['LOG_LEVEL'];
  readonly databaseUrl: string;
  readonly corsOrigins: readonly string[];
  readonly graphqlIntrospection: boolean;
  readonly graphqlMaxDepth: number;
}

export class InvalidConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'InvalidConfigError';
  }
}

/** `ConfigModule` `validate` hook: parses raw env vars and fails fast with every offending key listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
