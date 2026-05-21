# DocNear — Database Design

> Version: 1.1 | Engine: PostgreSQL 16 + PostGIS | ORM: Prisma
> Last updated: 2026-05-21

---

## CHANGELOG

### v1.1 (2026-05-21)
| # | Type | Change |
|---|------|--------|
| 1 | MUST FIX | Slot uniqueness: `bookings` partial unique index now includes `PENDING_PAYMENT`; `CANCELLED_BY_SYSTEM` added to both `cancelled_by_enum` and `booking_status_enum`; BullMQ sweep job documented |
| 2 | MUST FIX | Added `webhook_events` table with `UNIQUE(provider, event_id)` for Razorpay idempotency |
| 3 | MUST FIX | Added `doctor_bank_accounts` table with pgcrypto-encrypted `account_number_enc (BYTEA)` |
| 4 | MUST FIX | Added `applicable_to` column to `coupons`; added `coupon_redemptions` table with `per_user_limit` enforcement |
| 7 | SHOULD | Added `password_resets`, `phone_verifications`, `email_verifications`, `notification_preferences`, `system_settings` tables |
| 8 | SHOULD | Added `users.last_login_at TIMESTAMPTZ` |
| 9 | SHOULD | Added explicit `PRIMARY KEY (doctor_id, speciality_id)` to `doctor_specialities` |
| 10 | SHOULD | Added missing `created_at`/`updated_at` columns: `family_members`, `specialities`, `cities`, `blog_categories`, `pharmacy_categories`, `doctor_specialities` |
| 11 | SHOULD | `notifications` now partitioned by month (like `audit_logs`); 90-day archival policy documented |
| 12 | SHOULD | `clinics.location` is now a `GENERATED ALWAYS AS (ST_MakePoint(lng, lat)::geography) STORED` column — no trigger needed |
| 15 | SHOULD | Encrypted columns annotated with `-- ENCRYPTED` comments throughout; key management note added |
| 16 | SHOULD | Added `TECHNICAL_FAILURE` to `consultation_status_enum` |
| 17 | SHOULD | Doctor slug uniqueness strategy documented under `doctor_profiles` |
| 18 | SHOULD | `pharmacy_orders.items` JSONB item schema documented with price snapshot fields |

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        bytea email_enc
        text email_hash UK
        bytea phone_enc
        text phone_hash UK
        text password_hash
        role_enum role
        user_status_enum status
        text first_name
        text last_name
        text avatar_url
        text google_id UK
        boolean email_verified
        boolean phone_verified
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    doctor_profiles {
        uuid id PK
        uuid user_id FK UK
        text mci_reg_no UK
        text[] qualifications
        text bio
        int experience_years
        text gender
        text[] languages
        int consultation_fee_clinic
        int consultation_fee_online
        int slot_duration_minutes
        text registration_doc_url
        text id_proof_url
        doctor_status_enum verification_status
        text rejection_reason
        uuid verified_by FK
        timestamptz verified_at
        float avg_rating
        int total_reviews
        int total_consultations
        text slug UK
        timestamptz created_at
        timestamptz updated_at
    }

    doctor_bank_accounts {
        uuid id PK
        uuid doctor_id FK UK
        bytea account_number_enc
        text last4
        text ifsc_code
        text holder_name
        text bank_name
        text razorpay_contact_id
        text razorpay_fund_account_id
        boolean is_verified
        timestamptz created_at
        timestamptz updated_at
    }

    patient_profiles {
        uuid id PK
        uuid user_id FK UK
        bytea dob_enc
        text blood_group
        text gender
        bytea allergies_enc
        bytea chronic_conditions_enc
        patient_status_enum verification_status
        timestamptz created_at
        timestamptz updated_at
    }

    family_members {
        uuid id PK
        uuid patient_id FK
        text name
        text relation
        date dob
        text gender
        text blood_group
        text[] allergies
        timestamptz created_at
        timestamptz updated_at
    }

    specialities {
        uuid id PK
        text name UK
        text slug UK
        text icon_url
        text description
        boolean is_active
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    doctor_specialities {
        uuid doctor_id PK_FK
        uuid speciality_id PK_FK
        boolean is_primary
        timestamptz created_at
    }

    cities {
        uuid id PK
        text name
        text state
        text slug UK
        float lat
        float lng
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    clinics {
        uuid id PK
        uuid doctor_id FK
        text name
        text address_line1
        text address_line2
        uuid city_id FK
        text pincode
        float lat
        float lng
        geography location_generated
        text phone
        jsonb working_hours
        boolean is_active
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    doctor_availability {
        uuid id PK
        uuid doctor_id FK
        uuid clinic_id FK
        int day_of_week
        time start_time
        time end_time
        consultation_type_enum consult_type
        boolean is_active
        timestamptz created_at
    }

    availability_overrides {
        uuid id PK
        uuid doctor_id FK
        date override_date
        boolean is_day_off
        time start_time
        time end_time
        uuid clinic_id FK
        text reason
        timestamptz created_at
    }

    bookings {
        uuid id PK
        text booking_ref UK
        uuid doctor_id FK
        uuid patient_id FK
        uuid family_member_id FK
        uuid clinic_id FK
        timestamptz slot_datetime
        consultation_type_enum consult_type
        booking_status_enum status
        text patient_notes
        text doctor_notes
        int fee_charged
        uuid coupon_id FK
        int discount_amount
        text cancellation_reason
        cancelled_by_enum cancelled_by
        timestamptz cancelled_at
        timestamptz confirmed_at
        timestamptz completed_at
        timestamptz created_at
        timestamptz updated_at
    }

    payments {
        uuid id PK
        uuid booking_id FK UK
        text razorpay_order_id UK
        text razorpay_payment_id UK
        text razorpay_signature
        payment_status_enum status
        int amount_paise
        text currency
        text method
        jsonb gateway_response
        timestamptz paid_at
        timestamptz created_at
        timestamptz updated_at
    }

    webhook_events {
        uuid id PK
        text provider
        text event_id UK
        text event_type
        jsonb payload
        timestamptz processed_at
    }

    refunds {
        uuid id PK
        uuid payment_id FK
        text razorpay_refund_id UK
        int amount_paise
        refund_status_enum status
        text reason
        jsonb gateway_response
        timestamptz created_at
        timestamptz updated_at
    }

    consultations {
        uuid id PK
        uuid booking_id FK UK
        text hms_room_id
        text hms_room_code_doctor
        text hms_room_code_patient
        timestamptz started_at
        timestamptz ended_at
        int duration_seconds
        consultation_status_enum status
        timestamptz created_at
    }

    prescriptions {
        uuid id PK
        uuid booking_id FK UK
        uuid doctor_id FK
        uuid patient_id FK
        bytea medicines_enc
        bytea diagnosis_enc
        bytea advice_enc
        text follow_up_in
        text pdf_url
        boolean is_finalized
        timestamptz finalized_at
        timestamptz created_at
        timestamptz updated_at
    }

    reviews {
        uuid id PK
        uuid booking_id FK UK
        uuid doctor_id FK
        uuid patient_id FK
        int rating
        text comment
        text[] tags
        boolean is_visible
        timestamptz created_at
        timestamptz updated_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        notif_type_enum type
        notif_channel_enum channel
        text title
        text body
        jsonb data
        boolean is_read
        timestamptz sent_at
        timestamptz read_at
        notif_status_enum status
        text error_message
        timestamptz created_at
    }

    notification_preferences {
        uuid id PK
        uuid user_id FK
        notif_type_enum notif_type
        notif_channel_enum channel
        boolean is_enabled
        timestamptz updated_at
    }

    coupons {
        uuid id PK
        text code UK
        coupon_type_enum type
        coupon_applicable_enum applicable_to
        int value
        int min_order_amount
        int max_discount
        int usage_limit
        int per_user_limit
        int usage_count
        timestamptz valid_from
        timestamptz valid_until
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    coupon_redemptions {
        uuid id PK
        uuid coupon_id FK
        uuid user_id FK
        uuid booking_id FK
        uuid order_id FK
        timestamptz redeemed_at
    }

    blog_categories {
        uuid id PK
        text name UK
        text slug UK
        text description
        boolean is_active
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    blog_posts {
        uuid id PK
        text title
        text slug UK
        text excerpt
        text content_markdown
        text cover_image_url
        uuid author_id FK
        uuid category_id FK
        uuid speciality_id FK
        text[] tags
        text seo_title
        text seo_description
        text og_image_url
        int estimated_read_minutes
        blog_status_enum status
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
    }

    pharmacy_products {
        uuid id PK
        text name
        text generic_name
        text manufacturer
        text sku UK
        int price_paise
        int mrp_paise
        int stock_quantity
        boolean prescription_required
        text image_url
        uuid category_id FK
        text description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    pharmacy_categories {
        uuid id PK
        text name UK
        text slug UK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    pharmacy_orders {
        uuid id PK
        text order_ref UK
        uuid patient_id FK
        jsonb items
        int subtotal_paise
        int delivery_charge_paise
        int discount_paise
        int total_paise
        uuid coupon_id FK
        jsonb delivery_address
        text prescription_url
        pharmacy_order_status_enum status
        text notes
        timestamptz placed_at
        timestamptz updated_at
    }

    audit_logs {
        uuid id PK
        uuid actor_id FK
        text action
        text resource_type
        uuid resource_id
        jsonb old_value
        jsonb new_value
        text ip_address
        text user_agent
        timestamptz created_at
    }

    payouts {
        uuid id PK
        uuid doctor_id FK
        int amount_paise
        payout_status_enum status
        text utr_number
        text bank_account_last4
        timestamptz requested_at
        timestamptz processed_at
        uuid processed_by FK
        text notes
    }

    doctor_earnings {
        uuid id PK
        uuid doctor_id FK
        uuid booking_id FK UK
        int gross_amount_paise
        int platform_commission_paise
        int net_amount_paise
        boolean is_paid_out
        uuid payout_id FK
        timestamptz created_at
    }

    password_resets {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    phone_verifications {
        uuid id PK
        text phone
        text otp_hash
        text purpose
        int attempts
        timestamptz expires_at
        timestamptz verified_at
        timestamptz created_at
    }

    email_verifications {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz expires_at
        timestamptz verified_at
        timestamptz created_at
    }

    system_settings {
        uuid id PK
        text key UK
        jsonb value
        text description
        uuid updated_by FK
        timestamptz updated_at
    }

    %% Relationships
    users ||--o| doctor_profiles : "has"
    users ||--o| patient_profiles : "has"
    doctor_profiles ||--o| doctor_bank_accounts : "has"
    patient_profiles ||--o{ family_members : "has"
    doctor_profiles ||--o{ doctor_specialities : "has"
    specialities ||--o{ doctor_specialities : "tagged"
    doctor_profiles ||--o{ clinics : "owns"
    cities ||--o{ clinics : "in"
    doctor_profiles ||--o{ doctor_availability : "has"
    clinics ||--o{ doctor_availability : "for"
    doctor_profiles ||--o{ availability_overrides : "has"
    doctor_profiles ||--o{ bookings : "receives"
    patient_profiles ||--o{ bookings : "makes"
    family_members ||--o{ bookings : "for"
    clinics ||--o{ bookings : "at"
    bookings ||--o| payments : "has"
    payments ||--o{ refunds : "has"
    payments ||--o{ webhook_events : "deduplicated by"
    bookings ||--o| consultations : "has"
    bookings ||--o| prescriptions : "has"
    bookings ||--o| reviews : "has"
    bookings ||--o| doctor_earnings : "generates"
    doctor_earnings }o--|| payouts : "included in"
    users ||--o{ notifications : "receives"
    users ||--o{ notification_preferences : "configures"
    coupons ||--o{ coupon_redemptions : "redeemed via"
    users ||--o{ coupon_redemptions : "redeems"
    blog_posts }o--|| blog_categories : "in"
    blog_posts }o--o| specialities : "related"
    blog_posts }o--|| users : "authored"
    pharmacy_products }o--|| pharmacy_categories : "in"
    pharmacy_orders }o--|| patient_profiles : "placed by"
    pharmacy_orders }o--o{ coupon_redemptions : "recorded in"
    users ||--o{ password_resets : "requests"
    users ||--o{ email_verifications : "verifies"
```

---

## 2. Complete Table Definitions

### 2.1 Enumerations

```sql
CREATE TYPE role_enum AS ENUM ('SUPER_ADMIN', 'DOCTOR', 'PATIENT');
CREATE TYPE user_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE doctor_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE patient_status_enum AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
CREATE TYPE consultation_type_enum AS ENUM ('IN_CLINIC', 'VIDEO', 'HOME_VISIT');

-- v1.1: CANCELLED_BY_SYSTEM added for BullMQ auto-expiry
CREATE TYPE booking_status_enum AS ENUM (
  'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR',
  'CANCELLED_BY_SYSTEM', 'NO_SHOW'
);
-- v1.1: SYSTEM added for BullMQ auto-expiry
CREATE TYPE cancelled_by_enum AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM');

CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE refund_status_enum AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- v1.1: TECHNICAL_FAILURE added
CREATE TYPE consultation_status_enum AS ENUM (
  'WAITING', 'ACTIVE', 'COMPLETED', 'ABANDONED', 'TECHNICAL_FAILURE'
);

CREATE TYPE notif_type_enum AS ENUM (
  'BOOKING_CONFIRMED', 'BOOKING_REMINDER_24H', 'BOOKING_REMINDER_1H',
  'BOOKING_REMINDER_15M', 'CONSULT_STARTED', 'CONSULT_ENDED',
  'PRESCRIPTION_READY', 'BOOKING_CANCELLED', 'DOCTOR_APPROVED',
  'DOCTOR_REJECTED', 'REVIEW_REQUEST', 'PAYOUT_PROCESSED'
);
CREATE TYPE notif_channel_enum AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP');
CREATE TYPE notif_status_enum AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED');

-- v1.1: applicable_to for scoped coupons
CREATE TYPE coupon_type_enum AS ENUM ('FLAT', 'PERCENT');
CREATE TYPE coupon_applicable_enum AS ENUM ('BOOKING', 'PHARMACY', 'BOTH');

CREATE TYPE blog_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE pharmacy_order_status_enum AS ENUM (
  'PLACED', 'VERIFIED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
);
CREATE TYPE payout_status_enum AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');
```

---

### 2.2 `users`

```sql
-- v1.1: phone/email now stored encrypted (BYTEA) with a hash shadow column for uniqueness lookups.
--       last_login_at added.
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Encrypted storage. Use email_hash / phone_hash for unique-lookup queries.
  email_enc         BYTEA,                              -- ENCRYPTED (AES-256-CBC via CryptoService)
  email_hash        TEXT UNIQUE,                        -- SHA-256(lower(email)) — for lookup & uniqueness
  phone_enc         BYTEA,                              -- ENCRYPTED
  phone_hash        TEXT UNIQUE,                        -- SHA-256(phone) — for lookup & uniqueness

  password_hash     TEXT,                               -- bcrypt(12); NULL for OAuth users
  role              role_enum NOT NULL,
  status            user_status_enum NOT NULL DEFAULT 'PENDING',
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  avatar_url        TEXT,
  google_id         TEXT UNIQUE,
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at     TIMESTAMPTZ,                        -- v1.1
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT at_least_one_contact CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL)
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_google ON users(google_id) WHERE google_id IS NOT NULL;
```

> **Encryption note:** `email_enc` and `phone_enc` are encrypted by `CryptoService` before INSERT. All unique-lookup queries use the hash columns (`WHERE email_hash = SHA256(lower($input))`). Decryption happens in the application after fetch — never in SQL.

---

### 2.3 `doctor_profiles`

```sql
CREATE TABLE doctor_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mci_reg_no                TEXT NOT NULL UNIQUE,
  qualifications            TEXT[] NOT NULL DEFAULT '{}',
  bio                       TEXT,
  experience_years          INTEGER NOT NULL DEFAULT 0,
  gender                    TEXT,
  languages                 TEXT[] NOT NULL DEFAULT '{"English"}',
  consultation_fee_clinic   INTEGER NOT NULL DEFAULT 0,   -- in paise
  consultation_fee_online   INTEGER NOT NULL DEFAULT 0,   -- in paise
  slot_duration_minutes     INTEGER NOT NULL DEFAULT 15,
  registration_doc_url      TEXT,
  id_proof_url              TEXT,
  verification_status       doctor_status_enum NOT NULL DEFAULT 'PENDING',
  rejection_reason          TEXT,
  verified_by               UUID REFERENCES users(id),
  verified_at               TIMESTAMPTZ,
  avg_rating                FLOAT NOT NULL DEFAULT 0.0,
  total_reviews             INTEGER NOT NULL DEFAULT 0,
  total_consultations       INTEGER NOT NULL DEFAULT 0,
  slug                      TEXT NOT NULL UNIQUE,          -- see slug strategy below
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_profiles_verification ON doctor_profiles(verification_status);
CREATE INDEX idx_doctor_profiles_rating ON doctor_profiles(avg_rating DESC)
  WHERE verification_status = 'APPROVED';
CREATE INDEX idx_doctor_profiles_fee ON doctor_profiles(consultation_fee_clinic)
  WHERE verification_status = 'APPROVED';
```

#### Slug Uniqueness Strategy

Slugs are generated in `DoctorsService.generateSlug(firstName, lastName)`:

```typescript
async generateSlug(firstName: string, lastName: string): Promise<string> {
  const base = slugify(`${firstName}-${lastName}`, { lower: true, strict: true });
  let slug = base;
  let suffix = 2;
  while (await this.prisma.doctorProfiles.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug; // "dr-arun-sharma", "dr-arun-sharma-2", etc.
}
```

Slugs are set on initial profile creation and **never changed** (changing a slug breaks bookmarked URLs and SEO). If a doctor legally changes name, an alias/redirect is used instead.

---

### 2.4 `doctor_bank_accounts`

```sql
-- v1.1: NEW — stores bank details for doctor payouts via Razorpay Contacts + Fund Accounts API.
CREATE TABLE doctor_bank_accounts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id                 UUID NOT NULL UNIQUE REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  account_number_enc        BYTEA NOT NULL,               -- ENCRYPTED (AES-256-CBC)
  last4                     TEXT NOT NULL,                -- last 4 digits — plaintext for display
  ifsc_code                 TEXT NOT NULL,
  holder_name               TEXT NOT NULL,
  bank_name                 TEXT,
  razorpay_contact_id       TEXT,                         -- Razorpay Contacts API ID
  razorpay_fund_account_id  TEXT,                         -- Razorpay Fund Accounts API ID
  is_verified               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> **Encryption note:** The full account number is encrypted by `CryptoService` before INSERT. Only `last4` is stored in plaintext for display in payout records. `razorpay_fund_account_id` is the token used for actual payouts — the raw account number is never sent to Razorpay's API more than once during fund account creation.

---

### 2.5 `patient_profiles`

```sql
-- v1.1: dob, allergies, chronic_conditions now stored encrypted (BYTEA).
CREATE TABLE patient_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dob_enc                 BYTEA,                          -- ENCRYPTED — PHI
  blood_group             TEXT,                           -- non-sensitive; kept plaintext
  gender                  TEXT,
  allergies_enc           BYTEA,                          -- ENCRYPTED — PHI
  chronic_conditions_enc  BYTEA,                          -- ENCRYPTED — PHI
  verification_status     patient_status_enum NOT NULL DEFAULT 'PENDING',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.6 `family_members`

```sql
-- v1.1: added updated_at
CREATE TABLE family_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  relation     TEXT NOT NULL,  -- SPOUSE | CHILD | PARENT | SIBLING | OTHER
  dob          DATE,
  gender       TEXT,
  blood_group  TEXT,
  allergies    TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_patient ON family_members(patient_id);
```

---

### 2.7 `specialities`

```sql
-- v1.1: added updated_at
CREATE TABLE specialities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  icon_url    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_specialities_active ON specialities(sort_order) WHERE is_active = TRUE;
```

---

### 2.8 `doctor_specialities`

```sql
-- v1.1: explicit PRIMARY KEY added; created_at added
CREATE TABLE doctor_specialities (
  doctor_id      UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  speciality_id  UUID NOT NULL REFERENCES specialities(id) ON DELETE CASCADE,
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, speciality_id)
);

CREATE INDEX idx_doc_spec_speciality ON doctor_specialities(speciality_id);
-- Ensure each doctor has at most one primary speciality
CREATE UNIQUE INDEX idx_doc_spec_one_primary
  ON doctor_specialities(doctor_id)
  WHERE is_primary = TRUE;
```

---

### 2.9 `cities`

```sql
-- v1.1: added created_at, updated_at
CREATE TABLE cities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  state      TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  lat        FLOAT NOT NULL,
  lng        FLOAT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cities_active ON cities(name) WHERE is_active = TRUE;
```

---

### 2.10 `clinics`

```sql
-- v1.1: location is now a GENERATED column — no triggers needed
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE clinics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id      UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  address_line1  TEXT NOT NULL,
  address_line2  TEXT,
  city_id        UUID NOT NULL REFERENCES cities(id),
  pincode        TEXT NOT NULL,
  lat            FLOAT NOT NULL,
  lng            FLOAT NOT NULL,
  -- v1.1: generated from lat/lng — no manual sync or triggers required
  location       GEOGRAPHY GENERATED ALWAYS AS (ST_MakePoint(lng, lat)::geography) STORED,
  phone          TEXT,
  working_hours  JSONB NOT NULL DEFAULT '{}',
  -- working_hours shape: {"mon":{"open":"09:00","close":"17:00"},"tue":{...},...}
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_doctor ON clinics(doctor_id);
CREATE INDEX idx_clinics_location ON clinics USING GIST(location);
CREATE INDEX idx_clinics_city ON clinics(city_id) WHERE is_active = TRUE;
```

> **Generated column rationale:** Whenever `lat` or `lng` is updated via `UPDATE clinics SET lat=…, lng=…`, PostgreSQL automatically recomputes `location`. This removes the risk of `location` being stale and eliminates the need for any application-side or trigger-based sync.

---

### 2.11 `doctor_availability` & `availability_overrides`

```sql
CREATE TABLE doctor_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  clinic_id     UUID REFERENCES clinics(id) ON DELETE SET NULL,  -- NULL = online slot
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  consult_type  consultation_type_enum NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_doctor_day ON doctor_availability(doctor_id, day_of_week)
  WHERE is_active = TRUE;

CREATE TABLE availability_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id      UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  override_date  DATE NOT NULL,
  is_day_off     BOOLEAN NOT NULL DEFAULT FALSE,
  start_time     TIME,
  end_time       TIME,
  clinic_id      UUID REFERENCES clinics(id) ON DELETE SET NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT override_has_times CHECK (
    is_day_off = TRUE OR (start_time IS NOT NULL AND end_time IS NOT NULL)
  ),
  CONSTRAINT override_valid_range CHECK (
    is_day_off = TRUE OR end_time > start_time
  ),
  UNIQUE (doctor_id, override_date)
);
```

---

### 2.12 `bookings`

```sql
-- v1.1: CANCELLED_BY_SYSTEM added to booking_status_enum.
--       Partial unique index now INCLUDES PENDING_PAYMENT — PG is authoritative.
CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref         TEXT NOT NULL UNIQUE,       -- DOC-YYYYMMDD-XXXXXX
  doctor_id           UUID NOT NULL REFERENCES doctor_profiles(id),
  patient_id          UUID NOT NULL REFERENCES patient_profiles(id),
  family_member_id    UUID REFERENCES family_members(id),
  clinic_id           UUID REFERENCES clinics(id),
  slot_datetime       TIMESTAMPTZ NOT NULL,
  consult_type        consultation_type_enum NOT NULL,
  status              booking_status_enum NOT NULL DEFAULT 'PENDING_PAYMENT',
  patient_notes       TEXT,
  doctor_notes        TEXT,
  fee_charged         INTEGER NOT NULL,            -- in paise; locked at booking creation time
  coupon_id           UUID REFERENCES coupons(id),
  discount_amount     INTEGER NOT NULL DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_by        cancelled_by_enum,
  cancelled_at        TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v1.1: Index now excludes only terminal cancelled states.
--       PENDING_PAYMENT IS included — only one unresolved booking per slot at any time.
--       CANCELLED_BY_SYSTEM also excluded (terminal state, slot is free again).
CREATE UNIQUE INDEX idx_bookings_slot_unique
  ON bookings(doctor_id, slot_datetime)
  WHERE status NOT IN (
    'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR',
    'CANCELLED_BY_SYSTEM', 'NO_SHOW'
  );

CREATE INDEX idx_bookings_doctor ON bookings(doctor_id, slot_datetime DESC);
CREATE INDEX idx_bookings_patient ON bookings(patient_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings(status);
-- Index for BullMQ sweep job — fast scan of stale PENDING_PAYMENT rows
CREATE INDEX idx_bookings_pending_expiry
  ON bookings(created_at)
  WHERE status = 'PENDING_PAYMENT';
```

#### PENDING_PAYMENT Expiry — BullMQ Strategy

Two complementary mechanisms ensure stale `PENDING_PAYMENT` rows are always cleaned up:

| Mechanism | Trigger | Action |
|-----------|---------|--------|
| `BookingExpiryJob` (per-booking) | Enqueued at booking creation with `delay: 6 min` | `UPDATE bookings SET status=CANCELLED_BY_SYSTEM WHERE id=? AND status=PENDING_PAYMENT` |
| `BookingExpirySweepJob` (global) | BullMQ repeatable job, every 60 seconds | `UPDATE bookings SET status=CANCELLED_BY_SYSTEM WHERE status=PENDING_PAYMENT AND created_at < NOW() - INTERVAL '6 minutes'` |

The per-booking job is precise; the sweep is the safety net if the per-booking job is lost (Redis flush, BullMQ restart). Both are idempotent — the `WHERE status=PENDING_PAYMENT` guard prevents double-cancellation.

---

### 2.13 `payments`

```sql
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  razorpay_order_id     TEXT NOT NULL UNIQUE,
  razorpay_payment_id   TEXT UNIQUE,             -- set after webhook confirms payment
  razorpay_signature    TEXT,
  status                payment_status_enum NOT NULL DEFAULT 'PENDING',
  amount_paise          INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'INR',
  method                TEXT,                    -- 'upi', 'card', 'netbanking', etc.
  gateway_response      JSONB,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_status ON payments(status);
```

---

### 2.14 `webhook_events`

```sql
-- v1.1: NEW — idempotency table for all inbound webhooks.
--       INSERT … ON CONFLICT DO NOTHING; check rows affected to decide processing.
CREATE TABLE webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,                   -- 'razorpay', 'fcm', etc.
  event_id      TEXT NOT NULL,                   -- provider's globally unique event ID
  event_type    TEXT NOT NULL,                   -- 'payment.captured', 'refund.processed', etc.
  payload       JSONB NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_events UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_provider_date
  ON webhook_events(provider, processed_at DESC);
```

Usage in `PaymentsService.handleWebhook()`:
```typescript
const result = await this.prisma.$executeRaw`
  INSERT INTO webhook_events (provider, event_id, event_type, payload)
  VALUES ('razorpay', ${eventId}, ${eventType}, ${payload}::jsonb)
  ON CONFLICT (provider, event_id) DO NOTHING
`;
if (result === 0) {
  // Duplicate delivery — already processed
  this.logger.warn({ eventId }, 'Duplicate webhook received, skipping');
  return; // return HTTP 200 to Razorpay (do not retry)
}
// Proceed with payment confirmation...
```

---

### 2.15 `refunds`

```sql
CREATE TABLE refunds (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id           UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  razorpay_refund_id   TEXT UNIQUE,
  amount_paise         INTEGER NOT NULL,
  status               refund_status_enum NOT NULL DEFAULT 'PENDING',
  reason               TEXT,
  gateway_response     JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
```

---

### 2.16 `consultations`

```sql
-- v1.1: TECHNICAL_FAILURE added to consultation_status_enum
CREATE TABLE consultations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  hms_room_id           TEXT,                    -- 100ms room ID (set when room created)
  hms_room_code_doctor  TEXT,                    -- join code for doctor
  hms_room_code_patient TEXT,                    -- join code for patient
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  duration_seconds      INTEGER,
  status                consultation_status_enum NOT NULL DEFAULT 'WAITING',
  -- WAITING: room created, no one joined
  -- ACTIVE: at least one party connected
  -- COMPLETED: doctor ended normally
  -- ABANDONED: session closed with no clinical outcome
  -- TECHNICAL_FAILURE: connection lost, flagged for follow-up
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consultations_booking ON consultations(booking_id);
CREATE INDEX idx_consultations_status ON consultations(status)
  WHERE status IN ('WAITING', 'ACTIVE', 'TECHNICAL_FAILURE');
```

---

### 2.17 `prescriptions`

```sql
-- v1.1: medicines, diagnosis, advice stored encrypted (BYTEA) — PHI
CREATE TABLE prescriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  doctor_id     UUID NOT NULL REFERENCES doctor_profiles(id),
  patient_id    UUID NOT NULL REFERENCES patient_profiles(id),
  medicines_enc BYTEA NOT NULL DEFAULT '',       -- ENCRYPTED — PHI (decrypts to JSONB array)
  diagnosis_enc BYTEA,                           -- ENCRYPTED — PHI
  advice_enc    BYTEA,                           -- ENCRYPTED — PHI
  follow_up_in  TEXT,                            -- e.g. "2 weeks" — non-sensitive
  pdf_url       TEXT,                            -- signed S3 URL (regenerated on access)
  is_finalized  BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finalized_has_pdf CHECK (NOT is_finalized OR pdf_url IS NOT NULL)
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
```

**Decrypted `medicines` JSONB array schema** (see §9 for full item schema):
```json
[
  {
    "name": "Amoxicillin",
    "genericName": "Amoxicillin Trihydrate",
    "dosage": "500mg",
    "frequency": "3x daily",
    "duration": "7 days",
    "instructions": "After food",
    "qty": 21
  }
]
```

---

### 2.18 `reviews`

```sql
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(id),
  doctor_id   UUID NOT NULL REFERENCES doctor_profiles(id),
  patient_id  UUID NOT NULL REFERENCES patient_profiles(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  is_visible  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_doctor ON reviews(doctor_id, created_at DESC)
  WHERE is_visible = TRUE;
```

---

### 2.19 `notifications` (partitioned)

```sql
-- v1.1: Partitioned by month (like audit_logs). 90-day archival policy.
CREATE TABLE notifications (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           notif_type_enum NOT NULL,
  channel        notif_channel_enum NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  data           JSONB,
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at        TIMESTAMPTZ,
  read_at        TIMESTAMPTZ,
  status         notif_status_enum NOT NULL DEFAULT 'PENDING',
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions (created via migration + pg_cron job for future months)
CREATE TABLE notifications_2026_05 PARTITION OF notifications
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE notifications_2026_06 PARTITION OF notifications
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- ... auto-created by a partition-management cron (pg_cron or Prisma migration)

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id)
  WHERE is_read = FALSE;
```

**90-day archival policy:** A scheduled job (BullMQ or pg_cron) runs monthly:
```sql
-- Archive and drop partitions older than 90 days
-- Example: on 2026-09-01, drop notifications_2026_05 (91 days old)
-- Archived rows exported to S3 as JSONL before drop (audit trail)
DROP TABLE IF EXISTS notifications_2026_05;
```
Patients who want historical notifications can use the data-export endpoint (`GET /patients/me/data-export`), which queries the S3 archive.

---

### 2.20 `notification_preferences`

```sql
-- v1.1: NEW — per-user, per-channel opt-in/out
CREATE TABLE notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notif_type  notif_type_enum NOT NULL,
  channel     notif_channel_enum NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notif_pref UNIQUE (user_id, notif_type, channel)
);

-- Default behaviour: if no row exists for a (user, type, channel), treat as enabled.
-- Rows are only created when user explicitly disables a channel.
```

---

### 2.21 `coupons` & `coupon_redemptions`

```sql
-- v1.1: applicable_to and per_user_limit added
CREATE TABLE coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  type             coupon_type_enum NOT NULL,
  applicable_to    coupon_applicable_enum NOT NULL DEFAULT 'BOTH',  -- v1.1
  value            INTEGER NOT NULL,          -- flat paise amount OR percent (0-100)
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  max_discount     INTEGER,                   -- cap for PERCENT coupons (paise)
  usage_limit      INTEGER,                   -- NULL = unlimited total uses
  per_user_limit   INTEGER NOT NULL DEFAULT 1, -- v1.1: max redemptions per user
  usage_count      INTEGER NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (valid_until > valid_from),
  CONSTRAINT valid_percent CHECK (type != 'PERCENT' OR (value BETWEEN 1 AND 100))
);

CREATE INDEX idx_coupons_active ON coupons(code) WHERE is_active = TRUE;
CREATE INDEX idx_coupons_applicable ON coupons(applicable_to) WHERE is_active = TRUE;
```

```sql
-- v1.1: NEW — tracks every coupon redemption for per-user-limit enforcement
CREATE TABLE coupon_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id    UUID NOT NULL REFERENCES coupons(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  booking_id   UUID REFERENCES bookings(id),          -- set for BOOKING / BOTH coupons
  order_id     UUID REFERENCES pharmacy_orders(id),   -- set for PHARMACY / BOTH coupons
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_of_booking_or_order CHECK (
    booking_id IS NOT NULL OR order_id IS NOT NULL
  )
);

-- Per-user-limit enforcement index (application checks count before allowing redemption)
CREATE INDEX idx_coupon_redemptions_lookup ON coupon_redemptions(coupon_id, user_id);
```

**Per-user-limit enforcement in `CouponsService.validateCoupon()`:**
```typescript
const redemptionCount = await this.prisma.couponRedemptions.count({
  where: { couponId, userId },
});
if (redemptionCount >= coupon.perUserLimit) {
  throw new UnprocessableEntityException('You have already used this coupon');
}
```

---

### 2.22 `audit_logs` (partitioned)

```sql
CREATE TABLE audit_logs (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    UUID,
  old_value      JSONB,
  new_value      JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

Audit logs are **retained indefinitely** (regulatory requirement). Unlike notifications, they are never purged — only archived to S3 as JSONL if table size becomes unmanageable (> 1 billion rows), at which point old partitions are detached (not dropped) and queried via foreign data wrapper if needed.

---

### 2.23 `doctor_earnings` & `payouts`

```sql
CREATE TABLE doctor_earnings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id                 UUID NOT NULL REFERENCES doctor_profiles(id),
  booking_id                UUID NOT NULL UNIQUE REFERENCES bookings(id),
  gross_amount_paise        INTEGER NOT NULL,
  platform_commission_paise INTEGER NOT NULL,
  net_amount_paise          INTEGER NOT NULL,
  is_paid_out               BOOLEAN NOT NULL DEFAULT FALSE,
  payout_id                 UUID REFERENCES payouts(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earnings_sum CHECK (
    net_amount_paise = gross_amount_paise - platform_commission_paise
  )
);

CREATE INDEX idx_earnings_doctor_unpaid ON doctor_earnings(doctor_id)
  WHERE is_paid_out = FALSE;

CREATE TABLE payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id           UUID NOT NULL REFERENCES doctor_profiles(id),
  amount_paise        INTEGER NOT NULL,
  status              payout_status_enum NOT NULL DEFAULT 'REQUESTED',
  utr_number          TEXT,
  bank_account_last4  TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  processed_by        UUID REFERENCES users(id),
  notes               TEXT
);

CREATE INDEX idx_payouts_doctor ON payouts(doctor_id, requested_at DESC);
CREATE INDEX idx_payouts_status ON payouts(status) WHERE status = 'REQUESTED';
```

---

### 2.24 Auth & Verification Tables

```sql
-- v1.1: NEW
CREATE TABLE password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,          -- bcrypt(12) of the one-time reset token
  expires_at  TIMESTAMPTZ NOT NULL,   -- 15 minutes from creation
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_user ON password_resets(user_id, expires_at)
  WHERE used_at IS NULL;

-- v1.1: NEW — tracks OTP sends for phone verification / login
CREATE TABLE phone_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash   TEXT NOT NULL,         -- SHA-256(phone) — matches users.phone_hash
  otp_hash     TEXT NOT NULL,         -- bcrypt(12) of the 6-digit OTP
  purpose      TEXT NOT NULL,         -- 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD'
  attempts     INTEGER NOT NULL DEFAULT 0,  -- max 5 before record invalidated
  expires_at   TIMESTAMPTZ NOT NULL,  -- 10 minutes from creation
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phone_verifications_hash_purpose
  ON phone_verifications(phone_hash, purpose, expires_at)
  WHERE verified_at IS NULL;

-- v1.1: NEW — tracks email verification tokens
CREATE TABLE email_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,         -- bcrypt(12) of the verification token
  expires_at   TIMESTAMPTZ NOT NULL,  -- 24 hours from creation
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verifications_user
  ON email_verifications(user_id, expires_at)
  WHERE verified_at IS NULL;
```

---

### 2.25 `system_settings`

```sql
-- v1.1: NEW — key/value store for admin-configurable platform settings
CREATE TABLE system_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   UUID REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example rows:
-- { key: 'platform_commission_percent', value: 15 }
-- { key: 'slot_lock_ttl_seconds',       value: 360 }
-- { key: 'min_payout_amount_paise',     value: 50000 }
-- { key: 'cancellation_policy',         value: {"free_until_minutes": 120, "half_refund_minutes": 30} }
-- { key: 'pharmacy_delivery_charge',    value: 4900 }

-- All reads go through SystemSettingsService with 1-hour Redis cache.
-- Changes emit a cache-invalidation event.
```

---

### 2.26 Blog Tables

```sql
-- v1.1: blog_categories gains created_at, updated_at
CREATE TABLE blog_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blog_posts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  slug                    TEXT NOT NULL UNIQUE,
  excerpt                 TEXT,
  content_markdown        TEXT NOT NULL,
  cover_image_url         TEXT,
  author_id               UUID NOT NULL REFERENCES users(id),
  category_id             UUID REFERENCES blog_categories(id),
  speciality_id           UUID REFERENCES specialities(id),
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  seo_title               TEXT,
  seo_description         TEXT,
  og_image_url            TEXT,
  estimated_read_minutes  INTEGER NOT NULL DEFAULT 3,
  status                  blog_status_enum NOT NULL DEFAULT 'DRAFT',
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC)
  WHERE status = 'PUBLISHED';
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id)
  WHERE status = 'PUBLISHED';
CREATE INDEX idx_blog_posts_speciality ON blog_posts(speciality_id)
  WHERE status = 'PUBLISHED';
```

---

### 2.27 Pharmacy Tables

```sql
-- v1.1: pharmacy_categories gains created_at, updated_at
CREATE TABLE pharmacy_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pharmacy_products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  generic_name          TEXT,
  manufacturer          TEXT,
  sku                   TEXT NOT NULL UNIQUE,
  price_paise           INTEGER NOT NULL,
  mrp_paise             INTEGER NOT NULL,
  stock_quantity        INTEGER NOT NULL DEFAULT 0,
  prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
  image_url             TEXT,
  category_id           UUID REFERENCES pharmacy_categories(id),
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_price CHECK (price_paise <= mrp_paise)
);

CREATE INDEX idx_pharmacy_products_active ON pharmacy_products(category_id)
  WHERE is_active = TRUE;
CREATE INDEX idx_pharmacy_products_rx ON pharmacy_products(prescription_required)
  WHERE is_active = TRUE;
```

---

### 2.28 `pharmacy_orders`

```sql
-- v1.1: items JSONB schema explicitly documented (price snapshots required)
CREATE TABLE pharmacy_orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref                TEXT NOT NULL UNIQUE,
  patient_id               UUID NOT NULL REFERENCES patient_profiles(id),
  items                    JSONB NOT NULL,   -- see schema below
  subtotal_paise           INTEGER NOT NULL,
  delivery_charge_paise    INTEGER NOT NULL DEFAULT 0,
  discount_paise           INTEGER NOT NULL DEFAULT 0,
  total_paise              INTEGER NOT NULL,
  coupon_id                UUID REFERENCES coupons(id),
  delivery_address         JSONB NOT NULL,  -- snapshot of address at order time
  prescription_url         TEXT,
  status                   pharmacy_order_status_enum NOT NULL DEFAULT 'PLACED',
  notes                    TEXT,
  placed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_total_check CHECK (
    total_paise = subtotal_paise + delivery_charge_paise - discount_paise
  )
);

CREATE INDEX idx_pharmacy_orders_patient ON pharmacy_orders(patient_id, placed_at DESC);
CREATE INDEX idx_pharmacy_orders_status ON pharmacy_orders(status)
  WHERE status NOT IN ('DELIVERED', 'CANCELLED');
```

#### `items` JSONB Array Schema

Every element **must** include price snapshots at order time (so subsequent product price changes don't affect historical order values):

```json
[
  {
    "product_id": "uuid-v4",
    "product_name": "Amoxicillin 500mg Capsules",
    "generic_name": "Amoxicillin Trihydrate",
    "sku": "AMX-500-10",
    "manufacturer": "Cipla Ltd",
    "qty": 2,
    "price_at_order_time_paise": 2500,
    "mrp_at_order_time_paise": 3000,
    "prescription_required": true,
    "subtotal_paise": 5000
  }
]
```

**Validation:** `PharmacyService.createOrder()` fetches each product at order time, snapshots `price_paise` and `mrp_paise` into the item record, and recomputes `subtotal_paise = sum(qty × price_at_order_time_paise)`. Price in the JSONB is never trusted from the client request.

---

## 3. Row-Level Security (RLS) Policies

RLS is enforced at the application layer via service-level ownership assertions, not PG RLS (which adds complexity with Prisma's connection pool). Every service method that reads cross-user data includes an ownership check:

```typescript
// Example: DoctorsService.getPatientRecord()
async getPatientRecord(doctorId: string, patientId: string) {
  const booking = await this.prisma.bookings.findFirst({
    where: { doctorId, patientId, status: { in: ['COMPLETED', 'IN_PROGRESS'] } }
  });
  if (!booking) {
    throw new ForbiddenException('No active or completed consultation with this patient');
  }
  await this.audit.write({
    actorId: doctorId,
    action: 'VIEW_PATIENT_RECORD',
    resourceType: 'patient',
    resourceId: patientId,
  });
  return this.prisma.patientProfiles.findUnique({ where: { id: patientId } });
}
```

**Data isolation rules:**
| Actor | Can read | Cannot read |
|-------|----------|-------------|
| Patient | Own profile, own bookings, own prescriptions, own reviews, own orders | Any other patient's data |
| Doctor | Own profile, own bookings + linked patient profiles | Other doctors' patient relationships |
| Super Admin | All tables | — |

---

## 4. Migration Strategy (Prisma)

```bash
pnpm prisma migrate dev --name <description>   # dev: auto-applies
pnpm prisma migrate deploy                      # prod/staging: applies pending only
pnpm prisma migrate reset                       # dev only: destructive reset
```

### Naming Convention
`YYYYMMDDHHMMSS_description_snake_case`
e.g. `20260521_v1_init`, `20260522_v1_1_add_webhook_events`

### Rules
1. Never `DROP COLUMN` in production — add `_deprecated BOOLEAN DEFAULT FALSE` first; hard-drop after 2 releases
2. All new `NOT NULL` columns must have a `DEFAULT`
3. Indexes in production use `CREATE INDEX CONCURRENTLY` (add via raw SQL migration, not Prisma schema diff)
4. Data migrations are separate migration files from schema-change migrations
5. Every migration runs inside a transaction (`BEGIN … COMMIT`); DDL on partitioned tables may require `SET lock_timeout = '5s'`

---

## 5. Prisma Schema (Key Excerpts — v1.1 changes)

```prisma
model User {
  id            String    @id @default(uuid())
  emailEnc      Bytes?    @map("email_enc")           // ENCRYPTED
  emailHash     String?   @unique @map("email_hash")  // SHA-256 for lookup
  phoneEnc      Bytes?    @map("phone_enc")           // ENCRYPTED
  phoneHash     String?   @unique @map("phone_hash")  // SHA-256 for lookup
  passwordHash  String?   @map("password_hash")
  role          Role
  status        UserStatus @default(PENDING)
  firstName     String    @map("first_name")
  lastName      String    @map("last_name")
  avatarUrl     String?   @map("avatar_url")
  googleId      String?   @unique @map("google_id")
  emailVerified Boolean   @default(false) @map("email_verified")
  phoneVerified Boolean   @default(false) @map("phone_verified")
  lastLoginAt   DateTime? @map("last_login_at") @db.Timestamptz  // v1.1
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  doctorProfile         DoctorProfile?
  patientProfile        PatientProfile?
  notifications         Notification[]
  notifPreferences      NotificationPreference[]
  auditLogs             AuditLog[]
  passwordResets        PasswordReset[]
  emailVerifications    EmailVerification[]
  couponRedemptions     CouponRedemption[]

  @@map("users")
}

model DoctorSpeciality {
  doctorId      String    @map("doctor_id")
  specialityId  String    @map("speciality_id")
  isPrimary     Boolean   @default(false) @map("is_primary")
  createdAt     DateTime  @default(now()) @map("created_at")

  doctor        DoctorProfile @relation(fields: [doctorId], references: [id])
  speciality    Speciality    @relation(fields: [specialityId], references: [id])

  @@id([doctorId, specialityId])   // v1.1: explicit composite PK
  @@map("doctor_specialities")
}

model WebhookEvent {
  id           String   @id @default(uuid())
  provider     String
  eventId      String   @map("event_id")
  eventType    String   @map("event_type")
  payload      Json
  processedAt  DateTime @default(now()) @map("processed_at")

  @@unique([provider, eventId])
  @@map("webhook_events")
}

model DoctorBankAccount {
  id                     String   @id @default(uuid())
  doctorId               String   @unique @map("doctor_id")
  accountNumberEnc       Bytes    @map("account_number_enc")  // ENCRYPTED
  last4                  String   @map("last4")
  ifscCode               String   @map("ifsc_code")
  holderName             String   @map("holder_name")
  bankName               String?  @map("bank_name")
  razorpayContactId      String?  @map("razorpay_contact_id")
  razorpayFundAccountId  String?  @map("razorpay_fund_account_id")
  isVerified             Boolean  @default(false) @map("is_verified")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  doctor  DoctorProfile @relation(fields: [doctorId], references: [id])
  @@map("doctor_bank_accounts")
}

model Booking {
  // ... existing fields ...
  status    BookingStatus  @default(PENDING_PAYMENT)
  // v1.1: BookingStatus now includes CANCELLED_BY_SYSTEM

  @@index([doctorId, slotDatetime])
  @@index([patientId])
  @@index([status])
  // Partial unique index defined via raw SQL migration (Prisma doesn't support WHERE clause on @@unique)
  @@map("bookings")
}
```

> **Note on partial unique index:** Prisma's `@@unique` does not support `WHERE` predicates. The `idx_bookings_slot_unique` partial index is created via a raw SQL migration file (`migration.sql`), not Prisma schema. Prisma's generated client respects it at the DB level.

---

## 6. Seed Data Plan

### Seed Order (dependency-aware)

```
1.  system_settings (platform defaults)
2.  Super Admin user
3.  Specialities (50+)
4.  Cities (top 100 Indian cities)
5.  Pharmacy categories
6.  Blog categories
7.  Doctor users + profiles (3 test doctors)
8.  Doctor bank accounts (for the approved test doctor)
9.  Doctor specialities
10. Clinics for test doctors
11. Availability schedules
12. Patient users + profiles (2 test patients)
13. Coupon codes (1 BOOKING, 1 PHARMACY, 1 BOTH)
14. Sample bookings (CONFIRMED, COMPLETED, CANCELLED_BY_SYSTEM)
15. Sample consultations + prescriptions
16. Sample reviews
17. Sample blog posts
18. Sample pharmacy products + orders
```

### Key Seeds

```typescript
// Super Admin — driven by env vars
{
  emailHash: sha256(SUPER_ADMIN_EMAIL),
  emailEnc:  encrypt(SUPER_ADMIN_EMAIL),
  passwordHash: bcrypt(SUPER_ADMIN_PASSWORD),
  role: 'SUPER_ADMIN', status: 'APPROVED',
  firstName: 'Platform', lastName: 'Admin',
  emailVerified: true, phoneVerified: false,
}

// Default system settings
[
  { key: 'platform_commission_percent', value: 15, description: 'Platform fee %' },
  { key: 'slot_lock_ttl_seconds',       value: 360 },
  { key: 'min_payout_amount_paise',     value: 50000 },  // ₹500
  { key: 'pharmacy_delivery_charge_paise', value: 4900 }, // ₹49
  { key: 'cancellation_policy', value: { free_until_minutes: 120, half_refund_minutes: 30 } },
]
```

---

## 7. PostGIS Extension

```sql
-- Required extension (enabled in docker-compose init.sql and RDS parameter group)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Distance query example using generated column:
SELECT
  dp.id, dp.slug,
  u.first_name, u.last_name,
  dp.avg_rating,
  dp.consultation_fee_clinic,
  ST_Distance(c.location, ST_MakePoint(88.3639, 22.5726)::geography) AS distance_meters
FROM clinics c
JOIN doctor_profiles dp ON c.doctor_id = dp.id
JOIN users u ON dp.user_id = u.id
WHERE
  ST_DWithin(c.location, ST_MakePoint(88.3639, 22.5726)::geography, 5000)
  AND dp.verification_status = 'APPROVED'
  AND c.is_active = TRUE
ORDER BY distance_meters
LIMIT 20;

-- Note: no need to manually compute or update `location` — it's generated from lat/lng.
```

---

## 8. Column-Level Encryption Reference

| Table | Column | Type | Plain type | Sensitivity |
|-------|--------|------|------------|-------------|
| `users` | `email_enc` | `BYTEA` | TEXT (email) | PII |
| `users` | `phone_enc` | `BYTEA` | TEXT (phone) | PII |
| `patient_profiles` | `dob_enc` | `BYTEA` | DATE | PHI |
| `patient_profiles` | `allergies_enc` | `BYTEA` | TEXT[] as JSON | PHI |
| `patient_profiles` | `chronic_conditions_enc` | `BYTEA` | TEXT[] as JSON | PHI |
| `prescriptions` | `medicines_enc` | `BYTEA` | JSONB | PHI |
| `prescriptions` | `diagnosis_enc` | `BYTEA` | TEXT | PHI |
| `prescriptions` | `advice_enc` | `BYTEA` | TEXT | PHI |
| `doctor_bank_accounts` | `account_number_enc` | `BYTEA` | TEXT | PCI |

**Hash shadow columns** (plaintext hash stored for uniqueness + lookup, safe to expose):
| Table | Hash column | Hashes | Use |
|-------|-------------|--------|-----|
| `users` | `email_hash` | SHA-256(lower(email)) | UNIQUE constraint + WHERE lookup |
| `users` | `phone_hash` | SHA-256(phone) | UNIQUE constraint + WHERE lookup |
| `phone_verifications` | `phone_hash` | SHA-256(phone) | OTP lookup |

All encryption/decryption is performed by `CryptoService` in the API layer. The database never holds the encryption key. See architecture doc §7 for key rotation policy.

---

## 9. Backup Strategy

```yaml
# Nightly at 02:00 IST (20:30 UTC) — MVP: via DigitalOcean Spaces
schedule: "30 20 * * *"
steps:
  - pg_dump -Fc docnear_prod -Z 9 > backup_$(date +%Y%m%d).dump
  - AES-256-GCM encrypt with BACKUP_ENCRYPTION_KEY
  - upload to spaces://docnear-backups/pg/YYYY/MM/backup_YYYYMMDD.dump.enc
  - delete objects older than 30 days
  - alert ops Slack channel on failure within 5 minutes

# Point-in-time recovery (Phase 10 / AWS):
#   Enable RDS automated backups (7-day retention) + WAL archiving for RPO < 60s
```
