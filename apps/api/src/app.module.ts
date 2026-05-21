import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './core/config/configuration';
import { configValidationSchema } from './core/config/configuration.schema';
import { LoggerModule } from './core/logger/logger.module';
import { HealthModule } from './core/health/health.module';

// Domain modules — stubs; fully wired in Phase 4+
import { AuthModule } from './modules/auth/auth.module';
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
    HealthModule,

    // ── Rate limiting (global) ────────────────────────────────────────────────
    // Storage upgraded to Redis in Phase 4 when RedisModule is wired
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),

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
    NotificationsModule,
    PharmacyModule,
    BlogModule,
    AdminModule,
    AuditModule,
  ],
})
export class AppModule {}
