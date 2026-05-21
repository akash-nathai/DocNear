# DocNear — Pre-Launch Checklist

> Last updated: 2026-05-21
> Status: 🔴 Not ready (complete all items before launching)

---

## Security

- [ ] `pnpm audit` — zero critical or high vulnerabilities
- [ ] `gitleaks detect` — zero secrets in git history
- [ ] All `.env` values are production values (not dev defaults)
- [ ] `RAZORPAY_WEBHOOK_SECRET` matches the Razorpay dashboard value
- [ ] JWT secrets are ≥ 64 random chars (not the dev placeholders)
- [ ] `ENCRYPTION_KEY` is a 64-char hex string generated via `openssl rand -hex 32`
- [ ] Redis is password-protected (`requirepass` set)
- [ ] PostgreSQL is not exposed to the public internet (VPC only)
- [ ] S3 buckets are private — no public read ACLs on prescriptions or documents
- [ ] Signed URL expiry is ≤ 1 hour for prescription PDFs
- [ ] CORS locked to production domains (`CORS_ORIGINS=https://docnear.in`)
- [ ] Helmet headers enabled (CSP, HSTS, X-Frame-Options) ✅ (in main.ts)
- [ ] Rate limiting verified on `/v1/auth/*` (60 req/min default) ✅
- [ ] All admin routes require `SUPER_ADMIN` role ✅
- [ ] Razorpay webhook HMAC verification tested end-to-end ✅

## Infrastructure

- [ ] PostgreSQL 16 + PostGIS extension enabled on RDS
- [ ] Redis 7 ElastiCache cluster running with cluster mode OFF
- [ ] S3 bucket `docnear` created in `ap-south-1` with versioning ON
- [ ] MinIO replaced with real AWS S3 in production env vars
- [ ] Meilisearch running and indexed with all doctors
- [ ] ECS task definitions created for API + migrate task
- [ ] ECS service auto-scaling policy configured (min 2, max 10 tasks)
- [ ] ALB target group health check points to `/v1/health`
- [ ] CloudWatch alarms: CPU > 80%, memory > 80%, 5xx error rate > 1%
- [ ] Nightly DB backup Lambda deployed and tested
- [ ] VPC with private subnets for RDS + Redis; public subnet for ALB only

## Application

- [ ] `pnpm prisma migrate deploy` runs cleanly on production DB
- [ ] `pnpm prisma db seed` has been run with real super admin credentials
- [ ] Health check returns `{"status":"ok"}` with all dependencies green
- [ ] `GET /v1/auth/me` works with a valid JWT
- [ ] Full booking flow tested: create → Razorpay checkout → webhook → CONFIRMED
- [ ] Prescription PDF generated and accessible via signed URL
- [ ] WebSocket connection established from the web app
- [ ] BullMQ workers running: `booking-expiry` queue processes correctly
- [ ] Notification stubs replaced with real providers (MSG91, SendGrid, FCM) OR feature-flagged

## Payments

- [ ] Razorpay account is Live (not test mode)
- [ ] Razorpay Live `key_id` and `key_secret` set in production env
- [ ] Webhook URL registered in Razorpay dashboard: `https://api.docnear.in/v1/payments/webhook`
- [ ] Test a real ₹1 payment end-to-end in Razorpay Live
- [ ] Refund flow tested manually in Razorpay dashboard

## Compliance (DPDP Act 2023 / GDPR)

- [ ] Privacy Policy page live at `https://docnear.in/privacy`
- [ ] Terms of Service page live at `https://docnear.in/terms`
- [ ] Cookie consent banner live and working
- [ ] Patient data export endpoint implemented (Phase 10)
- [ ] Account deletion flow implemented and tested
- [ ] Prescription data retention policy documented (7 years)
- [ ] All PHI fields encrypted at rest (emailEnc, phoneEnc, dobEnc, medicinesEnc, etc.) ✅
- [ ] Audit log captures all PHI access by admin users ✅

## CI/CD

- [ ] GitHub Actions lint + test + build all green on `main`
- [ ] Deploy pipeline deploys successfully to staging
- [ ] Staging smoke tests pass
- [ ] Production deploy requires manual approval gate
- [ ] Rollback procedure tested (§7 in runbook)

## Performance

- [ ] k6 load test: 500 concurrent booking requests → 1 success, 499 × 409, p95 < 500ms
- [ ] Doctor search returns results in < 500ms (p95)
- [ ] Meilisearch indexes are warm (not cold-start)
- [ ] Redis slot lock TTL is set correctly (360s) ✅
- [ ] BullMQ expiry job delay is 15 minutes ✅

## Frontend & SEO

- [ ] Lighthouse score ≥ 90 on: Home, Search, Doctor Profile, Booking Flow, Dashboard
- [ ] axe-core 0 critical accessibility issues on all key pages
- [ ] Keyboard navigation works throughout booking flow
- [ ] JSON-LD MedicalBusiness schema on `/doctors/[slug]`
- [ ] JSON-LD Article schema on `/blog/[slug]`
- [ ] Dynamic OG images working for doctors + blog posts
- [ ] `robots.txt` and `sitemap.xml` are correct

## Monitoring & Observability

- [ ] Sentry SDK integrated in API + Web with DSN set
- [ ] Sentry PII scrubbing configured (no emails/phones in breadcrumbs)
- [ ] Pino structured logs flowing to CloudWatch
- [ ] Bull Dashboard deployed and password-protected
- [ ] Uptime monitoring configured (e.g. Freshping or Better Uptime)
- [ ] On-call rotation documented

## Go-Live

- [ ] DNS records updated (A record, CNAME for `api.docnear.in`)
- [ ] SSL certificate issued and auto-renewed (ACM)
- [ ] All items above checked ✅
- [ ] Stakeholder sign-off received
- [ ] Support email `support@docnear.in` is active
- [ ] **🚀 LAUNCH!**

---

*Sign-off: _______________________ Date: _______________________*
