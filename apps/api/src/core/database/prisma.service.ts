import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Log levels we subscribe to via $on()
type DocNearLogDef =
  | { emit: 'event'; level: 'query' }
  | { emit: 'event'; level: 'error' }
  | { emit: 'event'; level: 'warn' };

type DocNearClientOptions = { log: DocNearLogDef[] };

@Injectable()
export class PrismaService
  extends PrismaClient<DocNearClientOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Log slow queries (> 100 ms) in development
    if (process.env['NODE_ENV'] === 'development') {
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(
            `Slow query (${e.duration}ms): ${e.query.slice(0, 200)}`,
            'PrismaService',
          );
        }
      });
    }

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(e.message, 'PrismaService');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Truncate all tables in dependency-safe order.
   * Only for use in integration tests — never in production.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('cleanDatabase() is forbidden in production');
    }

    const tables = [
      'coupon_redemptions',
      'pharmacy_orders',
      'pharmacy_products',
      'pharmacy_categories',
      'blog_posts',
      'blog_categories',
      'doctor_earnings',
      'payouts',
      'reviews',
      'prescriptions',
      'consultations',
      'refunds',
      'webhook_events',
      'payments',
      'bookings',
      'availability_overrides',
      'doctor_availability',
      'clinics',
      'doctor_specialities',
      'specialities',
      'family_members',
      'patient_profiles',
      'doctor_bank_accounts',
      'doctor_profiles',
      'notifications',
      'notification_preferences',
      'audit_logs',
      'email_verifications',
      'phone_verifications',
      'password_resets',
      'system_settings',
      'coupons',
      'cities',
      'users',
    ];

    for (const table of tables) {
      await this.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
      );
    }
  }
}
