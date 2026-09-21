import { Module } from '@nestjs/common';
import { LoggerModule, type Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../di/tokens.js';
import { requestId } from './request-id.js';

/** pino-http options; `stream` lets tests capture the JSON log lines (stdout otherwise). */
export function loggerParams(config: AppConfig, stream?: DestinationStream): Params {
  const options = { level: config.logLevel, genReqId: requestId };
  return { pinoHttp: stream ? [options, stream] : options };
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => loggerParams(config),
    }),
  ],
})
export class LoggingModule {}
