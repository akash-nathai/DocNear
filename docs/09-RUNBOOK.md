# DocNear — Operations Runbook

> Last updated: 2026-05-21

---

## Quick Reference

| Service | URL | Notes |
|---------|-----|-------|
| API (prod) | https://api.docnear.in/v1 | ECS Fargate |
| API (staging) | https://api-staging.docnear.in/v1 | ECS Fargate |
| Web (prod) | https://docnear.in | Vercel |
| Admin | https://docnear.in/admin | SUPER_ADMIN only |
| Health check | https://api.docnear.in/v1/health | Should return `{"status":"ok"}` |
| Bull Dashboard | https://api.docnear.in/admin/queues | Password protected |
| Sentry | https://sentry.io/organizations/docnear | Errors & performance |
| AWS Console | https://console.aws.amazon.com | `ap-south-1` region |

---

## 1. Deploy a New Version

```bash
# Automatic: push to main → GitHub Actions deploys to staging
git push origin main

# Manual production deploy:
# 1. Merge to main
# 2. Go to GitHub Actions → Deploy → Run workflow → choose 'production'
# 3. Approve the 'production' environment gate in GitHub
```

---

## 2. Run Prisma Migrations (Emergency)

```bash
# SSH into ECS task or use AWS CloudShell:
DATABASE_URL="<prod-connection-string>" npx prisma migrate deploy
```

---

## 3. Scale the API

```bash
aws ecs update-service \
  --cluster docnear-cluster \
  --service docnear-api-service \
  --desired-count 4 \
  --region ap-south-1
```

---

## 4. Check Redis Slot Locks

```bash
# Redis CLI via AWS ElastiCache or local tunnel
redis-cli -u redis://:password@redis-endpoint:6379

# List active slot locks
SCAN 0 MATCH "slot:lock:*" COUNT 100

# Manually release a stuck lock
DEL "slot:lock:<doctorId>:<isoDatetime>"
```

---

## 5. Clear a Stuck BullMQ Job

```bash
# Via Bull Dashboard at /admin/queues (preferred)
# Or via Redis CLI:
# List all jobs in booking-expiry queue
LRANGE bull:booking-expiry:wait 0 -1

# Remove a specific job by ID
# (use Bull Dashboard UI — safer)
```

---

## 6. Force-Cancel a Booking

```sql
-- In Prisma Studio or psql:
UPDATE bookings
SET
  status = 'CANCELLED_BY_SYSTEM',
  cancelled_by = 'SYSTEM',
  cancelled_at = NOW(),
  cancellation_reason = 'Manual admin cancellation — <reason>'
WHERE id = '<booking-uuid>';

-- Then release the Redis slot lock manually (see §4)
```

---

## 7. Emergency Rollback

```bash
# Roll back to previous ECS task definition revision:
aws ecs update-service \
  --cluster docnear-cluster \
  --service docnear-api-service \
  --task-definition docnear-api:<previous-revision-number> \
  --region ap-south-1
```

---

## 8. PostgreSQL Backup & Restore

```bash
# Nightly backup runs automatically (Lambda cron → S3)
# Manual backup:
pg_dump $DATABASE_URL | gzip > docnear-$(date +%Y%m%d).sql.gz
aws s3 cp docnear-$(date +%Y%m%d).sql.gz s3://docnear-backups/manual/

# Restore:
aws s3 cp s3://docnear-backups/manual/docnear-YYYYMMDD.sql.gz .
gunzip docnear-YYYYMMDD.sql.gz
psql $DATABASE_URL < docnear-YYYYMMDD.sql
```

---

## 9. Incident Response Checklist

1. **Detect** — Sentry alert, health check failure, or user report
2. **Triage** — Check `/v1/health`, check ECS service status, check Redis connectivity
3. **Contain** — Scale down if needed; add maintenance mode page
4. **Investigate** — Check CloudWatch logs, Sentry trace, Bull Queue dashboard
5. **Fix** — Deploy fix or rollback
6. **Restore** — Verify health check green, smoke test booking flow
7. **Post-mortem** — Document in `docs/incidents/YYYY-MM-DD-<title>.md` within 24h

---

## 10. Common Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `409 SLOT_ALREADY_LOCKED` | Race condition handled correctly | Not an error — expected |
| `P2002 Unique constraint failed` | Duplicate DB write | Check idempotency key logic |
| `Redis ECONNREFUSED` | Redis down | Check ElastiCache, restart if needed |
| `PrismaClientKnownRequestError: P1001` | DB unreachable | Check RDS, security groups |
| `Invalid webhook signature` | Wrong `RAZORPAY_WEBHOOK_SECRET` | Verify env var matches Razorpay dashboard |
| `JWT expired` | Normal | Client should use refresh token |
| BullMQ worker not processing | `maxRetriesPerRequest` not null | Check Redis connection config |
