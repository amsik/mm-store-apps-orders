import { join } from 'node:path';
import { maxDepthRule } from '@escape.tech/graphql-armor-max-depth';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ClockModule } from './core/clock/clock.module.js';
import type { AppConfig } from './core/config/app-config.js';
import { AppConfigModule } from './core/config/config.module.js';
import { APP_CONFIG } from './core/di/tokens.js';
import { AppErrorFilter } from './core/errors/app-error.filter.js';
import { createFormatError } from './core/errors/format-error.js';
import { LoggingModule } from './core/logging/logging.module.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';

// Resolves to apps/api/schema.gql from both src/ (dev, tests) and dist/ (build).
const SCHEMA_FILE = join(import.meta.dirname, '..', 'schema.gql');

/** Composition root: the only place where modules, and through them concrete bindings, are wired. */
@Module({
  imports: [
    AppConfigModule,
    ClockModule,
    LoggingModule,
    PrismaModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // Emit the committed SDL contract everywhere except production, where the FS may be read-only.
        autoSchemaFile: config.nodeEnv === 'production' ? true : SCHEMA_FILE,
        sortSchema: true,
        introspection: config.graphqlIntrospection,
        graphiql: config.graphqlIntrospection,
        // Rejected during validation, before any resolver runs. Introspection queries are exempt. The rule throws
        // by default (it targets Envelop); reporting through the context gives a regular GRAPHQL_VALIDATION_FAILED.
        validationRules: [
          maxDepthRule({
            n: config.graphqlMaxDepth,
            propagateOnRejection: false,
            onReject: [(context, error) => context?.reportError(error)],
          }),
        ],
        // Set from our config: Apollo would otherwise decide from process.env.NODE_ENV.
        includeStacktraceInErrorResponses: config.nodeEnv !== 'production',
        formatError: createFormatError(config.nodeEnv),
      }),
    }),
    HealthModule,
    EmployeesModule,
    OrdersModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AppErrorFilter }],
})
export class AppModule {}
