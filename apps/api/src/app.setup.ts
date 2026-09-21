import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import type { AppConfig } from './core/config/app-config.js';
import { APP_CONFIG } from './core/di/tokens.js';
import { validationException } from './core/errors/validation-exception.js';

// Far above any real order payload; larger bodies are rejected with 413 before GraphQL parses them.
const MAX_BODY_SIZE = '100kb';

/** App-wide setup shared by `main.ts` and the integration tests, so both run the same pipeline. */
export function configureApp<T extends NestExpressApplication>(app: T): T {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));
  app.useBodyParser('json', { limit: MAX_BODY_SIZE });
  app.enableCors({ origin: [...config.corsOrigins] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
