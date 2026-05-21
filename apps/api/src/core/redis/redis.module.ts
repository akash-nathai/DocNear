import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * RedisModule — @Global so the REDIS_CLIENT token is available everywhere.
 * Wraps ioredis with a graceful shutdown hook.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('redis.url') ?? 'redis://localhost:6379';
        const client = new Redis(url, {
          maxRetriesPerRequest: null, // BullMQ requirement; harmless otherwise
          lazyConnect: true,
          enableReadyCheck: true,
        });

        const logger = new Logger('RedisModule');
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));
        client.on('close', () => logger.warn('Redis connection closed'));

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown(): Promise<void> {
    // Individual consumers (AuthService etc.) call redis.quit() on their own;
    // the factory instance is shared, so we let NestJS lifecycle handle it.
  }
}
