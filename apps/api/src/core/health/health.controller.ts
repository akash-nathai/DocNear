import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@Public() // health endpoints are unauthenticated
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /** Minimal DB ping — avoids generated-client type mismatch before `prisma generate` */
  private async dbPing(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { database: { status: 'down', message: msg } };
    }
  }

  /** GET /v1/health — liveness */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  /** GET /v1/ready — readiness: DB connectivity + memory */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.dbPing(),
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }
}
