# DocNear — Implementation TODOs (tracked, not yet scheduled)

> These items were identified during architecture review. None are blockers for Phase 2.
> Each item should be assigned to a specific phase before implementation.

---

| # | Item | Suggested Phase | Priority |
|---|------|----------------|----------|
| 1 | Wire pharmacy order creation to insert into `coupon_redemptions` (currently coupon is recorded on bookings but not pharmacy orders) | Phase 9 | High |
| 2 | Encrypt `consultations.hms_room_code_doctor` and `consultations.hms_room_code_patient` columns — these are session credentials and qualify as PHI-adjacent | Phase 7 | Medium |
| 3 | Convert `phone_verifications.purpose` from `TEXT` to a proper enum type (e.g. `verification_purpose_enum`: `REGISTER`, `LOGIN`, `RESET_PASSWORD`) | Phase 3 | Low |
| 4 | Decide audit trail strategy for `system_settings` changes — options: (a) use existing `audit_logs` table with `resource_type='system_settings'`, (b) add `system_settings_history` partitioned table, (c) store diff in `old_value`/`new_value` JSONB. Document decision in arch doc. | Phase 8 | Medium |
| 5 | Add `pg_cron` job to pre-create next 3 months of partitions on `audit_logs` and `notifications` on the 1st of each month. Without this, inserts will fail when the current month's partition doesn't exist yet. Scaffold the cron SQL in `infra/docker/init.sql`. | Phase 3 | High |
| 6 | Add `IMMUTABLE` policy on `doctor_profiles.slug` — implement as a PG trigger that raises an exception if `slug` is updated after initial set. Alternatively enforce in `DoctorsService.update()` by stripping `slug` from the update payload. | Phase 5 | Medium |
| 7 | Add `key_version INTEGER DEFAULT 1` column alongside every encrypted field (e.g. `phone_key_version`, `dob_key_version`) **before Phase 4** — needed for the key rotation procedure documented in arch doc §7 to work without a full table scan to determine which key version encrypted each row. | Phase 3 / before Phase 4 | High |
| 8 | Verify `NotificationsService.shouldSend()` implements the "no row = enabled" fallback logic correctly, and cover with a unit test: (a) user has no preference row → channel is enabled; (b) user has `is_enabled=false` row → channel is disabled; (c) user has `is_enabled=true` row → channel is enabled. | Phase 7 | High |

---

_Last updated: 2026-05-21 — added from v1.1 architecture review._
