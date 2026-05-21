import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

import { configuration } from './core/config/configuration';
import { configValidationSchema } from './core/config/configuration.schema';
import { LoggerModule } from './core/logger/logger.module';
import { HealthModule } from './core/health/health.module';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { CryptoModule } from './core/crypto/crypto.module';
import { StorageModule } from './core/storage/storage.module';
import { FirebaseModule } from './core/firebase/firebase.module';

// Domain modules
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SlotsModule } from './modules/slots/slots.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { BlogModule } from './modules/blog/blog.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // ── Core ──────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    LoggerModule,
    DatabaseModule,      // @Global — PrismaService available everywhere
    RedisModule,         // @Global — REDIS_CLIENT token available everywhere
    CryptoModule,        // @Global — CryptoService available everywhere
    StorageModule,       // @Global — StorageService (S3/MinIO) available everywhere
    FirebaseModule,      // @Global — FirebaseService (FCM) available everywhere
    AuditModule,         // @Global — AuditService available everywhere
    NotificationsModule, // @Global — NotificationsService available everywhere
    HealthModule,

    // ── Rate limiting (global) ────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),

    // ── BullMQ (job queues — uses same Redis) ─────────────────────────────────
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url')!,
          // BullMQ requires maxRetriesPerRequest: null on the ioredis client
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),

    // ── Domain ───────────────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    DoctorsModule,
    PatientsModule,
    SlotsModule,
    BookingsModule,
    PaymentsModule,
    ConsultationsModule,
    PrescriptionsModule,
    ReviewsModule,
    PharmacyModule,
    BlogModule,
    AdminModule,
  ],
  providers: [
    // ── Global JWT guard (secure-by-default) ─────────────────────────────────
    // Every route requires a valid access token UNLESS decorated with @Public().
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
