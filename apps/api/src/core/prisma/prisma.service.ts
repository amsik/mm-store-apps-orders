import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../di/tokens.js';

const PING_TIMEOUT_MS = 2_000;

/**
 * The Prisma client as a Nest singleton. It connects lazily on the first query instead of in
 * `onModuleInit`, so the API boots (and can report `db: DOWN`) while MongoDB is unreachable, and a
 * cold start doesn't wait on the database. The connection pool is closed on shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ datasourceUrl: config.databaseUrl });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** `true` if MongoDB answers a `ping` within the timeout. Never throws. */
  async isReachable(timeoutMs = PING_TIMEOUT_MS): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(resolve, timeoutMs, false);
    });
    const ping = this.$runCommandRaw({ ping: 1 }).then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([ping, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
