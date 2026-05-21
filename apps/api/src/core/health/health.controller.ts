import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /** GET /v1/health — liveness */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Liveness: heap < 500 MB
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  /** GET /v1/ready — readiness (DB + Redis added in Phase 3) */
  @Get('ready')
  ready() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.1',
      timestamp: new Date().toISOString(),
    };
  }
}
