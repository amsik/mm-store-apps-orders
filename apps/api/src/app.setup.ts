import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { validationException } from './core/errors/validation-exception.js';

/** App-wide setup shared by `main.ts` and the integration tests, so both run the same pipeline. */
export function configureApp<T extends INestApplication>(app: T): T {
  app.useLogger(app.get(Logger));
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
