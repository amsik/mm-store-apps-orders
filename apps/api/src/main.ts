import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { AppConfig } from './core/config/app-config.js';
import { APP_CONFIG } from './core/di/tokens.js';

const app = configureApp(await NestFactory.create(AppModule, { bufferLogs: true }));
await app.listen(app.get<AppConfig>(APP_CONFIG).port);
