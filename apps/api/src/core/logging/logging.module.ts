import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../di/tokens.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ pinoHttp: { level: config.logLevel } }),
    }),
  ],
})
export class LoggingModule {}
