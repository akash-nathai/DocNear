import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { randomUUID } from 'crypto';

export interface AuditParams {
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry — fire-and-forget (does NOT throw on failure).
   */
  async log(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          actorId: params.actorId ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          oldValue: params.oldValue !== undefined ? (params.oldValue as object) : undefined,
          newValue: params.newValue !== undefined ? (params.newValue as object) : undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit failure must never break the business flow
      this.logger.error('Failed to write audit log', err);
    }
  }
}
