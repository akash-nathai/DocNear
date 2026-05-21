# DocNear — Monorepo Folder Structure

> Version: 1.0
> Tooling: pnpm workspaces + Turborepo
> Last updated: 2026-05-21

---

## Full Tree

```
docnear/                                    ← monorepo root
├── .github/
│   ├── workflows/
│   │   ├── lint.yml                        ← runs on every PR
│   │   ├── test.yml                        ← unit + integration tests
│   │   ├── build.yml                       ← Docker build + push to ECR
│   │   ├── security-scan.yml               ← pnpm audit + gitleaks + OWASP ZAP
│   │   └── deploy-staging.yml              ← auto deploy on merge to main
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   └── dependabot.yml
│
├── apps/
│   ├── api/                                ← NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts                     ← bootstrap, Helmet, CORS, validation pipe
│   │   │   ├── app.module.ts               ← root module, imports all domain modules
│   │   │   │
│   │   │   ├── core/                       ← shared infra (no business logic)
│   │   │   │   ├── config/
│   │   │   │   │   ├── configuration.ts    ← typed env config (Joi validation)
│   │   │   │   │   └── configuration.schema.ts
│   │   │   │   ├── prisma/
│   │   │   │   │   ├── prisma.module.ts
│   │   │   │   │   └── prisma.service.ts   ← extended PrismaClient with soft-delete
│   │   │   │   ├── redis/
│   │   │   │   │   ├── redis.module.ts
│   │   │   │   │   └── redis.service.ts    ← typed Redis wrapper (ioredis)
│   │   │   │   ├── logger/
│   │   │   │   │   ├── logger.module.ts
│   │   │   │   │   └── logger.service.ts   ← Pino + correlation-id middleware
│   │   │   │   ├── health/
│   │   │   │   │   ├── health.controller.ts  ← GET /health, /ready
│   │   │   │   │   └── health.module.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── all-exceptions.filter.ts  ← standard error envelope
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── transform.interceptor.ts  ← wraps response in {success, data}
│   │   │   │   │   └── logging.interceptor.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   └── roles.guard.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts   ← @Roles(Role.DOCTOR)
│   │   │   │   │   └── current-user.decorator.ts
│   │   │   │   └── storage/
│   │   │   │       ├── storage.module.ts
│   │   │   │       └── storage.service.ts   ← S3/MinIO wrapper
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/
│   │   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   │   ├── jwt-refresh.strategy.ts
│   │   │   │   │   │   └── google.strategy.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── register-patient.dto.ts
│   │   │   │   │       ├── register-doctor.dto.ts
│   │   │   │   │       ├── login.dto.ts
│   │   │   │   │       └── otp.dto.ts
│   │   │   │   │
│   │   │   │   ├── users/
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       └── update-user.dto.ts
│   │   │   │   │
│   │   │   │   ├── doctors/
│   │   │   │   │   ├── doctors.module.ts
│   │   │   │   │   ├── doctors.controller.ts
│   │   │   │   │   ├── doctors.service.ts
│   │   │   │   │   ├── doctors.search.service.ts  ← Meilisearch sync
│   │   │   │   │   ├── availability.service.ts    ← slot generation logic
│   │   │   │   │   ├── clinics.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── search-doctors.dto.ts
│   │   │   │   │       ├── update-profile.dto.ts
│   │   │   │   │       ├── set-availability.dto.ts
│   │   │   │   │       └── upsert-clinic.dto.ts
│   │   │   │   │
│   │   │   │   ├── patients/
│   │   │   │   │   ├── patients.module.ts
│   │   │   │   │   ├── patients.controller.ts
│   │   │   │   │   ├── patients.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── update-profile.dto.ts
│   │   │   │   │       └── upsert-family-member.dto.ts
│   │   │   │   │
│   │   │   │   ├── slots/
│   │   │   │   │   ├── slots.module.ts
│   │   │   │   │   ├── slots.service.ts      ← lock / release / generate
│   │   │   │   │   └── slots.util.ts         ← slot expansion from schedule
│   │   │   │   │
│   │   │   │   ├── bookings/
│   │   │   │   │   ├── bookings.module.ts
│   │   │   │   │   ├── bookings.controller.ts
│   │   │   │   │   ├── bookings.service.ts
│   │   │   │   │   ├── bookings.gateway.ts   ← Socket.IO gateway
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── create-booking.dto.ts
│   │   │   │   │       ├── lock-slot.dto.ts
│   │   │   │   │       ├── cancel-booking.dto.ts
│   │   │   │   │       └── reschedule-booking.dto.ts
│   │   │   │   │
│   │   │   │   ├── payments/
│   │   │   │   │   ├── payments.module.ts
│   │   │   │   │   ├── payments.controller.ts
│   │   │   │   │   ├── payments.service.ts   ← Razorpay wrapper + webhook handler
│   │   │   │   │   └── dto/
│   │   │   │   │       └── webhook-payload.dto.ts
│   │   │   │   │
│   │   │   │   ├── consultations/
│   │   │   │   │   ├── consultations.module.ts
│   │   │   │   │   ├── consultations.controller.ts
│   │   │   │   │   ├── consultations.service.ts  ← 100ms room creation stub
│   │   │   │   │   └── dto/
│   │   │   │   │       └── join-consult.dto.ts
│   │   │   │   │
│   │   │   │   ├── prescriptions/
│   │   │   │   │   ├── prescriptions.module.ts
│   │   │   │   │   ├── prescriptions.controller.ts
│   │   │   │   │   ├── prescriptions.service.ts
│   │   │   │   │   ├── prescription-pdf.service.ts  ← pdf-lib PDF generation
│   │   │   │   │   └── dto/
│   │   │   │   │       └── upsert-prescription.dto.ts
│   │   │   │   │
│   │   │   │   ├── reviews/
│   │   │   │   │   ├── reviews.module.ts
│   │   │   │   │   ├── reviews.controller.ts
│   │   │   │   │   ├── reviews.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       └── create-review.dto.ts
│   │   │   │   │
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── notifications.module.ts
│   │   │   │   │   ├── notifications.controller.ts
│   │   │   │   │   ├── notifications.service.ts  ← dispatcher (channel routing)
│   │   │   │   │   ├── channels/
│   │   │   │   │   │   ├── fcm.channel.ts        ← Firebase stub
│   │   │   │   │   │   ├── sms.channel.ts        ← MSG91 stub
│   │   │   │   │   │   ├── email.channel.ts      ← SendGrid stub
│   │   │   │   │   │   └── whatsapp.channel.ts   ← WhatsApp stub
│   │   │   │   │   └── templates/
│   │   │   │   │       ├── booking-confirmed.ts
│   │   │   │   │       ├── booking-reminder.ts
│   │   │   │   │       └── prescription-ready.ts
│   │   │   │   │
│   │   │   │   ├── pharmacy/
│   │   │   │   │   ├── pharmacy.module.ts
│   │   │   │   │   ├── products.controller.ts
│   │   │   │   │   ├── orders.controller.ts
│   │   │   │   │   ├── pharmacy.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── create-order.dto.ts
│   │   │   │   │       └── update-order-status.dto.ts
│   │   │   │   │
│   │   │   │   ├── blog/
│   │   │   │   │   ├── blog.module.ts
│   │   │   │   │   ├── blog.controller.ts
│   │   │   │   │   ├── blog.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── create-post.dto.ts
│   │   │   │   │       └── update-post.dto.ts
│   │   │   │   │
│   │   │   │   ├── admin/
│   │   │   │   │   ├── admin.module.ts
│   │   │   │   │   ├── admin.controller.ts
│   │   │   │   │   ├── admin-doctors.controller.ts
│   │   │   │   │   ├── admin-patients.controller.ts
│   │   │   │   │   ├── admin-bookings.controller.ts
│   │   │   │   │   ├── admin-analytics.controller.ts
│   │   │   │   │   ├── admin-payouts.controller.ts
│   │   │   │   │   ├── admin-coupons.controller.ts
│   │   │   │   │   ├── admin.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       └── approve-reject.dto.ts
│   │   │   │   │
│   │   │   │   └── audit/
│   │   │   │       ├── audit.module.ts
│   │   │   │       └── audit.service.ts      ← write-only, imported everywhere
│   │   │   │
│   │   │   └── common/                       ← pure TS utilities, no NestJS deps
│   │   │       ├── constants.ts
│   │   │       ├── booking-ref.util.ts       ← generate DOC-YYYYMMDD-XXXXX
│   │   │       ├── slot-expander.util.ts     ← schedule → datetime slots
│   │   │       ├── refund-policy.util.ts     ← calculates refund amount
│   │   │       └── indian-phone.util.ts      ← phone normalization
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   │   └── 20260521120000_init/
│   │   │   │       └── migration.sql
│   │   │   └── seed/
│   │   │       ├── index.ts                  ← orchestrates seed order
│   │   │       ├── admin.seed.ts
│   │   │       ├── specialities.seed.ts
│   │   │       ├── cities.seed.ts
│   │   │       ├── doctors.seed.ts
│   │   │       └── patients.seed.ts
│   │   │
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   │   ├── slots.service.spec.ts
│   │   │   │   ├── bookings.service.spec.ts
│   │   │   │   ├── refund-policy.util.spec.ts
│   │   │   │   └── auth.service.spec.ts
│   │   │   ├── integration/
│   │   │   │   ├── booking-lifecycle.spec.ts
│   │   │   │   └── concurrent-slot-booking.spec.ts  ← 100 concurrent requests test
│   │   │   └── e2e/
│   │   │       └── auth.e2e-spec.ts
│   │   │
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── .env.example
│   │   └── nest-cli.json
│   │
│   ├── web/                                  ← Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx               ← root layout (fonts, providers)
│   │   │   │   ├── globals.css
│   │   │   │   ├── not-found.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   │
│   │   │   │   ├── (public)/                ← no auth required
│   │   │   │   │   ├── page.tsx             ← home page
│   │   │   │   │   ├── find-doctors/
│   │   │   │   │   │   └── page.tsx         ← search + map
│   │   │   │   │   ├── doctors/
│   │   │   │   │   │   └── [slug]/
│   │   │   │   │   │       └── page.tsx     ← doctor public profile
│   │   │   │   │   ├── specialities/
│   │   │   │   │   │   └── [slug]/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── blog/
│   │   │   │   │   │   ├── page.tsx         ← blog index
│   │   │   │   │   │   └── [slug]/
│   │   │   │   │   │       └── page.tsx     ← article detail
│   │   │   │   │   └── pharmacy/
│   │   │   │   │       └── page.tsx         ← product listing
│   │   │   │   │
│   │   │   │   ├── (auth)/                  ← redirects logged-in users
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── signup/
│   │   │   │   │   │   ├── patient/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── doctor/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   └── auth/
│   │   │   │   │       └── callback/        ← Google OAuth callback
│   │   │   │   │           └── page.tsx
│   │   │   │   │
│   │   │   │   ├── (patient)/               ← role=PATIENT required
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── bookings/
│   │   │   │   │   │   ├── page.tsx         ← booking history
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx     ← booking detail
│   │   │   │   │   ├── prescriptions/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── consult/
│   │   │   │   │   │   └── [bookingId]/
│   │   │   │   │   │       └── page.tsx     ← video consult room
│   │   │   │   │   ├── family/
│   │   │   │   │   │   └── page.tsx         ← family member management
│   │   │   │   │   ├── orders/
│   │   │   │   │   │   └── page.tsx         ← pharmacy order history
│   │   │   │   │   ├── notifications/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── settings/
│   │   │   │   │       └── page.tsx
│   │   │   │   │
│   │   │   │   ├── (doctor)/                ← role=DOCTOR required
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   └── page.tsx         ← today's queue
│   │   │   │   │   ├── appointments/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── consult/
│   │   │   │   │   │   └── [bookingId]/
│   │   │   │   │   │       └── page.tsx     ← video consult room (doctor view)
│   │   │   │   │   ├── prescriptions/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── profile/
│   │   │   │   │   │   ├── page.tsx         ← edit profile
│   │   │   │   │   │   └── availability/
│   │   │   │   │   │       └── page.tsx     ← weekly schedule builder
│   │   │   │   │   ├── earnings/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── reviews/
│   │   │   │   │       └── page.tsx
│   │   │   │   │
│   │   │   │   └── (admin)/                 ← role=SUPER_ADMIN required
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── page.tsx             ← dashboard KPIs
│   │   │   │       ├── doctors/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── [id]/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── patients/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── bookings/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── specialities/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── cities/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── blog/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── [id]/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── pharmacy/
│   │   │   │       │   ├── products/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── orders/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── coupons/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── payouts/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── analytics/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── audit-logs/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ui/                      ← shadcn/ui components (auto-generated)
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── layout/
│   │   │   │   │   ├── navbar.tsx
│   │   │   │   │   ├── footer.tsx
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   └── mobile-nav.tsx
│   │   │   │   ├── doctor/
│   │   │   │   │   ├── doctor-card.tsx      ← search result card
│   │   │   │   │   ├── doctor-map.tsx       ← map with markers
│   │   │   │   │   ├── slot-picker.tsx      ← calendar + time grid
│   │   │   │   │   ├── review-card.tsx
│   │   │   │   │   └── availability-builder.tsx  ← weekly schedule UI
│   │   │   │   ├── booking/
│   │   │   │   │   ├── booking-card.tsx
│   │   │   │   │   ├── booking-status-badge.tsx
│   │   │   │   │   ├── cancellation-modal.tsx
│   │   │   │   │   └── payment-summary.tsx
│   │   │   │   ├── consult/
│   │   │   │   │   ├── video-room.tsx       ← 100ms SDK integration stub
│   │   │   │   │   ├── prescription-form.tsx
│   │   │   │   │   └── prescription-view.tsx
│   │   │   │   ├── search/
│   │   │   │   │   ├── search-bar.tsx
│   │   │   │   │   └── filter-sidebar.tsx
│   │   │   │   └── shared/
│   │   │   │       ├── otp-input.tsx
│   │   │   │       ├── file-uploader.tsx
│   │   │   │       ├── location-picker.tsx
│   │   │   │       ├── rating-stars.tsx
│   │   │   │       ├── skeleton-card.tsx
│   │   │   │       └── empty-state.tsx
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts            ← axios instance with interceptors
│   │   │   │   ├── query-client.ts          ← TanStack Query client
│   │   │   │   ├── socket.ts                ← Socket.IO client singleton
│   │   │   │   ├── auth-store.ts            ← Zustand auth state
│   │   │   │   ├── utils.ts                 ← cn(), formatters, etc.
│   │   │   │   └── validations/
│   │   │   │       ├── auth.schema.ts       ← Zod schemas (shared with API)
│   │   │   │       ├── booking.schema.ts
│   │   │   │       └── profile.schema.ts
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts
│   │   │   │   ├── use-geolocation.ts
│   │   │   │   ├── use-doctors.ts
│   │   │   │   ├── use-bookings.ts
│   │   │   │   ├── use-slot-lock.ts         ← manages 5-min countdown
│   │   │   │   ├── use-notifications.ts
│   │   │   │   └── use-socket.ts
│   │   │   │
│   │   │   ├── providers/
│   │   │   │   ├── query-provider.tsx
│   │   │   │   ├── auth-provider.tsx
│   │   │   │   └── socket-provider.tsx
│   │   │   │
│   │   │   └── i18n/
│   │   │       ├── config.ts                ← next-intl config
│   │   │       ├── routing.ts
│   │   │       └── messages/
│   │   │           ├── en.json
│   │   │           ├── hi.json
│   │   │           └── bn.json
│   │   │
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── manifest.json               ← PWA manifest
│   │   │
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── components.json                  ← shadcn/ui config
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   └── mobile/                             ← Expo (React Native)
│       ├── src/
│       │   ├── app/                        ← expo-router file-based routing
│       │   │   ├── _layout.tsx
│       │   │   ├── (tabs)/
│       │   │   │   ├── index.tsx           ← Home
│       │   │   │   ├── search.tsx          ← Doctor search
│       │   │   │   ├── bookings.tsx
│       │   │   │   └── profile.tsx
│       │   │   ├── doctor/
│       │   │   │   └── [slug].tsx
│       │   │   ├── booking/
│       │   │   │   └── [id].tsx
│       │   │   └── consult/
│       │   │       └── [bookingId].tsx
│       │   ├── components/
│       │   ├── lib/
│       │   └── hooks/
│       ├── assets/
│       ├── app.json
│       ├── babel.config.js
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/                       ← TypeScript types shared across apps
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── user.types.ts
│   │   │   ├── doctor.types.ts
│   │   │   ├── booking.types.ts
│   │   │   ├── prescription.types.ts
│   │   │   ├── notification.types.ts
│   │   │   └── api-response.types.ts       ← ApiResponse<T>, PaginatedResponse<T>
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                                 ← shared UI components (shadcn base)
│   │   ├── src/
│   │   │   └── index.ts                    ← re-exports from web/components/ui
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── config/                             ← shared tooling configs
│       ├── eslint/
│       │   └── index.js
│       ├── tsconfig/
│       │   ├── base.json
│       │   ├── nextjs.json
│       │   └── react-native.json
│       └── tailwind/
│           └── preset.ts                   ← DocNear design tokens
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml              ← local dev: PG + Redis + Meili + MinIO
│   │   ├── docker-compose.test.yml         ← isolated DBs for integration tests
│   │   └── nginx/
│   │       └── nginx.conf
│   └── k8s/                               ← Phase 10+ (placeholder)
│       └── README.md
│
├── docs/
│   ├── 01-ARCHITECTURE.md
│   ├── 02-DATABASE.md
│   ├── 03-API-CONTRACTS.md
│   ├── 04-USER-FLOWS.md
│   ├── 05-FOLDER-STRUCTURE.md             ← this file
│   ├── 06-PHASE-PLAN.md
│   ├── 07-SRS.md                          ← generated after Phase 1 review
│   ├── 08-DESIGN-SYSTEM.md               ← Phase 8
│   ├── 09-RUNBOOK.md                     ← Phase 10
│   └── 10-LAUNCH-CHECKLIST.md            ← Phase 10
│
├── scripts/
│   ├── setup.sh                           ← fresh dev machine setup
│   ├── seed-dev.sh
│   └── generate-types.sh                  ← Prisma → shared-types sync
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                            ← root dev dependencies + scripts
├── .npmrc
├── .nvmrc                                  ← Node 20
├── .editorconfig
├── .gitignore
├── .gitleaks.toml                          ← secret scanning config
└── README.md
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Route groups `(public)/(auth)/(patient)/(doctor)/(admin)` | Enforces layout separation and auth middleware per section without URL pollution |
| Admin in same Next.js app | Reduces infrastructure cost; separate layout guards access. Can be split later. |
| `core/` vs `modules/` in API | Core = infrastructure (PrismaService, RedisService, Logger). Modules = business. Never mix. |
| `common/` for pure utilities | Zero NestJS dependencies → can be unit tested without spinning up NestJS |
| Socket.IO gateway co-located with bookings module | Booking events are the primary real-time concern; avoids a separate WS service |
| `packages/shared-types` | Types defined once (from API contracts), consumed by web + mobile — eliminates drift |
| `packages/config/tailwind/preset.ts` | DocNear design tokens defined once, imported by web + future mobile web |
