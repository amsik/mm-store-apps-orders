import { Global, Module } from '@nestjs/common';
import { CLOCK } from '../di/tokens.js';
import { systemClock } from './clock.js';

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
