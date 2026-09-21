import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_CONFIG } from '../di/tokens.js';
import { type AppConfig, type Env, validateEnv } from './app-config.js';

/** Validates the environment once at boot and exposes it as a typed, immutable `AppConfig`. */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ validate: validateEnv })],
  providers: [
    {
      provide: APP_CONFIG,
      inject: [ConfigService],
      useFactory: (env: ConfigService<Env, true>): AppConfig =>
        Object.freeze({
          nodeEnv: env.get('NODE_ENV', { infer: true }),
          port: env.get('PORT', { infer: true }),
          logLevel: env.get('LOG_LEVEL', { infer: true }),
          databaseUrl: env.get('DATABASE_URL', { infer: true }),
          corsOrigins: env.get('CORS_ORIGINS', { infer: true }),
          graphqlIntrospection: env.get('GRAPHQL_INTROSPECTION', { infer: true }),
          graphqlMaxDepth: env.get('GRAPHQL_MAX_DEPTH', { infer: true }),
        }),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
