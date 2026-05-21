# DocNear — API Contracts

> Version: v1 | Format: OpenAPI 3.1 | Base URL: `https://api.docnear.in/v1`
> Last updated: 2026-05-21

---

## 1. Standards

### Base URL & Versioning
```
Production:  https://api.docnear.in/v1
Staging:     https://api-staging.docnear.in/v1
Dev:         http://localhost:4000/v1
```

Version is a **path prefix** (`/v1`). When breaking changes are needed, `/v2` is introduced while `/v1` is maintained for 6 months with deprecation headers.

### Standard Response Envelope

All responses follow this envelope:

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 243 }   // only on paginated endpoints
}

// Error
{
  "success": false,
  "error": {
    "code": "SLOT_ALREADY_LOCKED",
    "message": "This slot is currently held by another user. Please choose a different time.",
    "details": [],              // array of field-level errors (validation)
    "trace_id": "abc-123"       // for Sentry correlation
  }
}
```

### Pagination
All list endpoints support:
```
?page=1&limit=20&sort=created_at&order=desc
```

### Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Zod validation failed (details[] contains field errors) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but insufficient role/ownership |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Unique constraint violated (e.g., slot already booked) |
| 409 | `SLOT_ALREADY_LOCKED` | Slot locked by another user |
| 410 | `LOCK_EXPIRED` | Slot lock TTL expired before booking was created |
| 422 | `UNPROCESSABLE` | Business rule violation (e.g., cancellation past window) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `GATEWAY_ERROR` | External service (Razorpay, MSG91) failed |

### Rate Limits

| Route Pattern | Limit | Window |
|--------------|-------|--------|
| `POST /auth/*` | 5 req | 60s per IP |
| `POST /auth/otp/*` | 3 req | 300s per phone |
| `POST /bookings/lock` | 10 req | 60s per user |
| `POST /bookings` | 5 req | 60s per user |
| `GET /doctors` (search) | 60 req | 60s per IP |
| All other authenticated | 200 req | 60s per user |
| All other unauthenticated | 30 req | 60s per IP |

Rate limit response headers:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1716300060
```

---

## 2. OpenAPI 3.1 Specification

```yaml
openapi: 3.1.0
info:
  title: DocNear API
  version: 1.0.0
  description: Doctor booking platform API — India-first, geolocation-first
  contact:
    email: dev@docnear.in

servers:
  - url: https://api.docnear.in/v1
    description: Production
  - url: https://api-staging.docnear.in/v1
    description: Staging
  - url: http://localhost:4000/v1
    description: Development

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    # ─── Common ───────────────────────────────────────────────────────────────
    PaginationMeta:
      type: object
      properties:
        page: { type: integer }
        limit: { type: integer }
        total: { type: integer }
        totalPages: { type: integer }

    ApiError:
      type: object
      required: [success, error]
      properties:
        success: { type: boolean, enum: [false] }
        error:
          type: object
          required: [code, message]
          properties:
            code: { type: string }
            message: { type: string }
            details:
              type: array
              items:
                type: object
                properties:
                  field: { type: string }
                  message: { type: string }
            trace_id: { type: string }

    # ─── Auth ─────────────────────────────────────────────────────────────────
    AuthTokens:
      type: object
      properties:
        access_token: { type: string }
        token_type: { type: string, enum: [Bearer] }
        expires_in: { type: integer, description: Seconds }

    # ─── User ─────────────────────────────────────────────────────────────────
    UserRole:
      type: string
      enum: [SUPER_ADMIN, DOCTOR, PATIENT]

    UserStatus:
      type: string
      enum: [PENDING, APPROVED, REJECTED, SUSPENDED]

    User:
      type: object
      properties:
        id: { type: string, format: uuid }
        email: { type: string, format: email }
        phone: { type: string }
        role: { $ref: '#/components/schemas/UserRole' }
        status: { $ref: '#/components/schemas/UserStatus' }
        firstName: { type: string }
        lastName: { type: string }
        avatarUrl: { type: string, format: uri }
        emailVerified: { type: boolean }
        phoneVerified: { type: boolean }
        createdAt: { type: string, format: date-time }

    # ─── Doctor ───────────────────────────────────────────────────────────────
    DoctorProfile:
      type: object
      properties:
        id: { type: string, format: uuid }
        userId: { type: string, format: uuid }
        mciRegNo: { type: string }
        qualifications: { type: array, items: { type: string } }
        bio: { type: string }
        experienceYears: { type: integer }
        gender: { type: string, enum: [MALE, FEMALE, OTHER] }
        languages: { type: array, items: { type: string } }
        consultationFeeClinic: { type: integer, description: In paise }
        consultationFeeOnline: { type: integer, description: In paise }
        slotDurationMinutes: { type: integer }
        verificationStatus:
          type: string
          enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
        avgRating: { type: number, format: float }
        totalReviews: { type: integer }
        totalConsultations: { type: integer }
        slug: { type: string }
        specialities:
          type: array
          items:
            type: object
            properties:
              id: { type: string, format: uuid }
              name: { type: string }
              isPrimary: { type: boolean }
        clinics:
          type: array
          items: { $ref: '#/components/schemas/Clinic' }

    DoctorSearchResult:
      type: object
      properties:
        id: { type: string, format: uuid }
        slug: { type: string }
        firstName: { type: string }
        lastName: { type: string }
        avatarUrl: { type: string }
        qualifications: { type: array, items: { type: string } }
        experienceYears: { type: integer }
        primarySpeciality: { type: string }
        consultationFeeClinic: { type: integer }
        consultationFeeOnline: { type: integer }
        avgRating: { type: number }
        totalReviews: { type: integer }
        nearestClinic: { $ref: '#/components/schemas/Clinic' }
        distanceMeters: { type: number }
        nextAvailableSlot: { type: string, format: date-time }

    # ─── Clinic ───────────────────────────────────────────────────────────────
    Clinic:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        addressLine1: { type: string }
        addressLine2: { type: string }
        city: { type: string }
        pincode: { type: string }
        lat: { type: number }
        lng: { type: number }
        phone: { type: string }
        workingHours: { type: object }

    # ─── Booking ──────────────────────────────────────────────────────────────
    BookingStatus:
      type: string
      enum:
        [PENDING_PAYMENT, CONFIRMED, IN_PROGRESS, COMPLETED,
         CANCELLED_BY_PATIENT, CANCELLED_BY_DOCTOR, NO_SHOW]

    Booking:
      type: object
      properties:
        id: { type: string, format: uuid }
        bookingRef: { type: string, example: DOC-20260521-A3X9K }
        doctor:
          type: object
          properties:
            id: { type: string }
            firstName: { type: string }
            lastName: { type: string }
            avatarUrl: { type: string }
            primarySpeciality: { type: string }
        patient:
          type: object
          properties:
            id: { type: string }
            firstName: { type: string }
            lastName: { type: string }
        clinic: { $ref: '#/components/schemas/Clinic' }
        slotDatetime: { type: string, format: date-time }
        consultType:
          type: string
          enum: [IN_CLINIC, VIDEO, HOME_VISIT]
        status: { $ref: '#/components/schemas/BookingStatus' }
        feeCharged: { type: integer }
        discountAmount: { type: integer }
        patientNotes: { type: string }
        confirmedAt: { type: string, format: date-time }
        completedAt: { type: string, format: date-time }
        createdAt: { type: string, format: date-time }

    # ─── Slot ─────────────────────────────────────────────────────────────────
    SlotGroup:
      type: object
      properties:
        date: { type: string, format: date }
        morning:
          type: array
          items: { $ref: '#/components/schemas/Slot' }
        afternoon:
          type: array
          items: { $ref: '#/components/schemas/Slot' }
        evening:
          type: array
          items: { $ref: '#/components/schemas/Slot' }

    Slot:
      type: object
      properties:
        datetime: { type: string, format: date-time }
        isAvailable: { type: boolean }
        consultType: { type: string, enum: [IN_CLINIC, VIDEO] }
        clinicId: { type: string, format: uuid }

    # ─── Prescription ─────────────────────────────────────────────────────────
    Medicine:
      type: object
      required: [name, dosage, frequency, duration]
      properties:
        name: { type: string }
        genericName: { type: string }
        dosage: { type: string, example: 500mg }
        frequency: { type: string, example: "3x daily" }
        duration: { type: string, example: "7 days" }
        instructions: { type: string, example: "After food" }
        qty: { type: integer }

    Prescription:
      type: object
      properties:
        id: { type: string, format: uuid }
        bookingId: { type: string, format: uuid }
        medicines:
          type: array
          items: { $ref: '#/components/schemas/Medicine' }
        diagnosis: { type: string }
        advice: { type: string }
        followUpIn: { type: string }
        pdfUrl: { type: string, format: uri }
        isFinalized: { type: boolean }
        finalizedAt: { type: string, format: date-time }

    # ─── Review ───────────────────────────────────────────────────────────────
    Review:
      type: object
      properties:
        id: { type: string, format: uuid }
        rating: { type: integer, minimum: 1, maximum: 5 }
        comment: { type: string }
        tags: { type: array, items: { type: string } }
        patientName: { type: string }
        createdAt: { type: string, format: date-time }

# ═══════════════════════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════════════════════
paths:

  # ─── Health ──────────────────────────────────────────────────────────────────
  /health:
    get:
      summary: Liveness check
      tags: [System]
      security: []
      responses:
        '200':
          description: Service is up
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, enum: [ok] }
                  uptime: { type: number }
                  version: { type: string }

  /ready:
    get:
      summary: Readiness check (DB + Redis + Meilisearch)
      tags: [System]
      security: []
      responses:
        '200': { description: All dependencies healthy }
        '503': { description: One or more dependencies unhealthy }

  # ─── Auth ─────────────────────────────────────────────────────────────────────
  /auth/register/patient:
    post:
      summary: Register as patient
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [firstName, lastName, phone]
              properties:
                firstName: { type: string, minLength: 1, maxLength: 50 }
                lastName: { type: string, minLength: 1, maxLength: 50 }
                phone: { type: string, pattern: '^[6-9]\d{9}$' }
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
      responses:
        '201':
          description: Patient registered. OTP sent to phone.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      userId: { type: string, format: uuid }
                      message: { type: string }
        '409': { description: Phone or email already registered }

  /auth/register/doctor:
    post:
      summary: Register as doctor (multipart — includes doc uploads)
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [firstName, lastName, email, password, mciRegNo, qualifications]
              properties:
                firstName: { type: string }
                lastName: { type: string }
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
                phone: { type: string }
                mciRegNo: { type: string }
                qualifications:
                  type: array
                  items: { type: string }
                  minItems: 1
                experienceYears: { type: integer, minimum: 0 }
                registrationDoc:
                  type: string
                  format: binary
                idProof:
                  type: string
                  format: binary
      responses:
        '201':
          description: Doctor registered. Pending admin verification.
        '409': { description: Email, phone, or MCI number already registered }

  /auth/otp/send:
    post:
      summary: Send OTP to phone
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone: { type: string, pattern: '^[6-9]\d{9}$' }
                purpose:
                  type: string
                  enum: [REGISTER, LOGIN, RESET_PASSWORD]
      responses:
        '200': { description: OTP sent }
        '429': { description: Rate limited }

  /auth/otp/verify:
    post:
      summary: Verify OTP and issue tokens
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone, otp]
              properties:
                phone: { type: string }
                otp: { type: string, minLength: 6, maxLength: 6 }
      responses:
        '200':
          description: OTP verified, tokens issued
          headers:
            Set-Cookie:
              schema: { type: string }
              description: refresh_token httpOnly cookie
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/AuthTokens' }
        '401': { description: Invalid or expired OTP }

  /auth/login:
    post:
      summary: Login with email/password
      tags: [Auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string }
      responses:
        '200':
          description: Login successful
          headers:
            Set-Cookie:
              schema: { type: string }
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/AuthTokens' }
        '401': { description: Invalid credentials }
        '403': { description: Account suspended or not approved }

  /auth/refresh:
    post:
      summary: Refresh access token using refresh cookie
      tags: [Auth]
      security: []
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/AuthTokens' }
        '401': { description: Invalid or expired refresh token }

  /auth/logout:
    post:
      summary: Logout (revoke tokens)
      tags: [Auth]
      security:
        - BearerAuth: []
      responses:
        '200': { description: Logged out }

  /auth/google:
    get:
      summary: Initiate Google OAuth
      tags: [Auth]
      security: []
      responses:
        '302': { description: Redirect to Google consent screen }

  /auth/google/callback:
    get:
      summary: Google OAuth callback
      tags: [Auth]
      security: []
      responses:
        '302': { description: Redirect to app with tokens }

  /auth/me:
    get:
      summary: Get current user profile
      tags: [Auth]
      security:
        - BearerAuth: []
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/User' }

  # ─── Doctors ──────────────────────────────────────────────────────────────────
  /doctors:
    get:
      summary: Search and list doctors
      tags: [Doctors]
      security: []
      parameters:
        - name: q
          in: query
          schema: { type: string }
          description: Name, speciality, or condition search
        - name: speciality
          in: query
          schema: { type: string }
          description: Speciality slug or ID
        - name: city
          in: query
          schema: { type: string }
          description: City slug or ID
        - name: lat
          in: query
          schema: { type: number }
        - name: lng
          in: query
          schema: { type: number }
        - name: radius
          in: query
          schema: { type: integer, default: 10000 }
          description: Radius in meters (default 10km)
        - name: min_fee
          in: query
          schema: { type: integer }
          description: Min fee in paise
        - name: max_fee
          in: query
          schema: { type: integer }
        - name: gender
          in: query
          schema: { type: string, enum: [MALE, FEMALE, OTHER] }
        - name: language
          in: query
          schema: { type: string }
        - name: available_today
          in: query
          schema: { type: boolean }
        - name: consult_type
          in: query
          schema: { type: string, enum: [IN_CLINIC, VIDEO] }
        - name: sort
          in: query
          schema:
            type: string
            enum: [distance, rating, fee_asc, fee_desc, experience]
            default: distance
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 50 }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/DoctorSearchResult' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }

  /doctors/{slug}:
    get:
      summary: Get doctor public profile
      tags: [Doctors]
      security: []
      parameters:
        - name: slug
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/DoctorProfile' }
        '404': { description: Doctor not found }

  /doctors/me/profile:
    get:
      summary: Get own doctor profile (doctor only)
      tags: [Doctors]
      security:
        - BearerAuth: []
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/DoctorProfile' }

    patch:
      summary: Update own doctor profile
      tags: [Doctors]
      security:
        - BearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                bio: { type: string }
                experienceYears: { type: integer }
                languages: { type: array, items: { type: string } }
                consultationFeeClinic: { type: integer }
                consultationFeeOnline: { type: integer }
                slotDurationMinutes: { type: integer, enum: [10, 15, 20, 30] }
      responses:
        '200': { description: Profile updated }

  /doctors/me/availability:
    get:
      summary: Get own availability schedule
      tags: [Doctors]
      security:
        - BearerAuth: []
      responses:
        '200': { description: Availability schedule }

    put:
      summary: Set weekly availability schedule
      tags: [Doctors]
      security:
        - BearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                schedule:
                  type: array
                  items:
                    type: object
                    required: [dayOfWeek, startTime, endTime, consultType]
                    properties:
                      dayOfWeek: { type: integer, minimum: 0, maximum: 6 }
                      startTime: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$' }
                      endTime: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$' }
                      consultType: { type: string, enum: [IN_CLINIC, VIDEO] }
                      clinicId: { type: string, format: uuid }
      responses:
        '200': { description: Schedule updated }

  /doctors/{doctorId}/slots:
    get:
      summary: Get available slots for a doctor
      tags: [Doctors, Slots]
      security: []
      parameters:
        - name: doctorId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: from
          in: query
          required: true
          schema: { type: string, format: date }
        - name: to
          in: query
          schema: { type: string, format: date }
          description: Default = from + 7 days
        - name: consult_type
          in: query
          schema: { type: string, enum: [IN_CLINIC, VIDEO] }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/SlotGroup' }

  /doctors/{doctorId}/reviews:
    get:
      summary: Get reviews for a doctor
      tags: [Doctors, Reviews]
      security: []
      parameters:
        - name: doctorId
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 10, maximum: 50 }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Review' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }

  # ─── Bookings ─────────────────────────────────────────────────────────────────
  /bookings/lock:
    post:
      summary: Lock a slot before payment (5 min hold)
      tags: [Bookings]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [doctorId, slotDatetime, consultType]
              properties:
                doctorId: { type: string, format: uuid }
                slotDatetime: { type: string, format: date-time }
                consultType: { type: string, enum: [IN_CLINIC, VIDEO] }
                clinicId:
                  type: string
                  format: uuid
                  description: Required for IN_CLINIC
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      lockId: { type: string }
                      expiresAt: { type: string, format: date-time }
                      expiresInSeconds: { type: integer }
        '409':
          description: Slot already locked or booked
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ApiError' }

  /bookings:
    post:
      summary: Create booking (must have valid slot lock)
      tags: [Bookings]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [lockId, doctorId, slotDatetime, consultType]
              properties:
                lockId: { type: string }
                doctorId: { type: string, format: uuid }
                slotDatetime: { type: string, format: date-time }
                consultType: { type: string, enum: [IN_CLINIC, VIDEO] }
                clinicId: { type: string, format: uuid }
                familyMemberId: { type: string, format: uuid }
                patientNotes: { type: string, maxLength: 500 }
                couponCode: { type: string }
      responses:
        '201':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      booking: { $ref: '#/components/schemas/Booking' }
                      payment:
                        type: object
                        properties:
                          razorpayOrderId: { type: string }
                          amount: { type: integer }
                          currency: { type: string }
                          keyId: { type: string }
        '410': { description: Slot lock expired }
        '409': { description: Slot already booked (PG constraint) }

    get:
      summary: List own bookings (patient sees own, doctor sees their queue)
      tags: [Bookings]
      security:
        - BearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [PENDING_PAYMENT, CONFIRMED, IN_PROGRESS, COMPLETED,
                   CANCELLED_BY_PATIENT, CANCELLED_BY_DOCTOR, NO_SHOW]
        - name: from
          in: query
          schema: { type: string, format: date }
        - name: to
          in: query
          schema: { type: string, format: date }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Booking' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }

  /bookings/{id}:
    get:
      summary: Get booking details
      tags: [Bookings]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/Booking' }

  /bookings/{id}/cancel:
    post:
      summary: Cancel a booking
      tags: [Bookings]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                reason: { type: string, maxLength: 300 }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      bookingId: { type: string }
                      refundAmount: { type: integer, description: Paise }
                      refundPolicy: { type: string }
        '422': { description: Cannot cancel past the cancellation window }

  /bookings/{id}/reschedule:
    post:
      summary: Reschedule booking (patient only, 7-day window)
      tags: [Bookings]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [newSlotDatetime, newLockId]
              properties:
                newSlotDatetime: { type: string, format: date-time }
                newLockId: { type: string }
      responses:
        '200': { description: Booking rescheduled }

  # ─── Payments ─────────────────────────────────────────────────────────────────
  /payments/webhook:
    post:
      summary: Razorpay webhook (server-to-server)
      tags: [Payments]
      security: []
      description: >
        Validates X-Razorpay-Signature HMAC. Updates booking status.
        Endpoint must be whitelisted in Razorpay dashboard.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              description: Razorpay event payload
      responses:
        '200': { description: Webhook processed }
        '400': { description: Invalid signature }

  # ─── Prescriptions ────────────────────────────────────────────────────────────
  /prescriptions/{bookingId}:
    get:
      summary: Get prescription for a booking
      tags: [Prescriptions]
      security:
        - BearerAuth: []
      parameters:
        - name: bookingId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/Prescription' }

    put:
      summary: Create/update prescription (doctor only, before finalize)
      tags: [Prescriptions]
      security:
        - BearerAuth: []
      parameters:
        - name: bookingId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                medicines:
                  type: array
                  items: { $ref: '#/components/schemas/Medicine' }
                diagnosis: { type: string }
                advice: { type: string }
                followUpIn: { type: string }
      responses:
        '200': { description: Prescription saved (draft) }
        '409': { description: Prescription already finalized }

  /prescriptions/{bookingId}/finalize:
    post:
      summary: Finalize prescription (immutable, generates PDF)
      tags: [Prescriptions]
      security:
        - BearerAuth: []
      parameters:
        - name: bookingId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      pdfUrl: { type: string, format: uri }

  # ─── Reviews ─────────────────────────────────────────────────────────────────
  /reviews:
    post:
      summary: Submit review (patient, only after COMPLETED booking)
      tags: [Reviews]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [bookingId, rating]
              properties:
                bookingId: { type: string, format: uuid }
                rating: { type: integer, minimum: 1, maximum: 5 }
                comment: { type: string, maxLength: 1000 }
                tags:
                  type: array
                  items:
                    type: string
                    enum:
                      [waited_too_long, very_thorough, excellent_diagnosis,
                       friendly_staff, good_prescription, would_recommend,
                       poor_communication, overcharged]
      responses:
        '201':
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/Review' }
        '409': { description: Review already submitted for this booking }
        '422': { description: Booking not completed yet }

  # ─── Admin ────────────────────────────────────────────────────────────────────
  /admin/doctors:
    get:
      summary: List all doctors with filters (admin only)
      tags: [Admin]
      security:
        - BearerAuth: []
      parameters:
        - name: status
          in: query
          schema: { type: string, enum: [PENDING, APPROVED, REJECTED, SUSPENDED] }
        - name: q
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer }
        - name: limit
          in: query
          schema: { type: integer }
      responses:
        '200': { description: Doctor list }

  /admin/doctors/{id}/approve:
    post:
      summary: Approve doctor registration
      tags: [Admin]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200': { description: Doctor approved, notification sent }

  /admin/doctors/{id}/reject:
    post:
      summary: Reject doctor registration
      tags: [Admin]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason: { type: string, minLength: 10 }
      responses:
        '200': { description: Doctor rejected }

  /admin/analytics/kpis:
    get:
      summary: Dashboard KPIs
      tags: [Admin]
      security:
        - BearerAuth: []
      parameters:
        - name: period
          in: query
          schema: { type: string, enum: [today, week, month, year], default: today }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      totalBookings: { type: integer }
                      totalRevenue: { type: integer }
                      newDoctors: { type: integer }
                      newPatients: { type: integer }
                      pendingApprovals: { type: integer }
                      activeConsultations: { type: integer }

  /admin/payouts:
    get:
      summary: List pending doctor payouts
      tags: [Admin]
      security:
        - BearerAuth: []
      responses:
        '200': { description: Payout list }

  /admin/payouts/{id}/process:
    post:
      summary: Mark payout as processed
      tags: [Admin]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [utrNumber]
              properties:
                utrNumber: { type: string }
      responses:
        '200': { description: Payout marked processed }

  # ─── Notifications ────────────────────────────────────────────────────────────
  /notifications:
    get:
      summary: Get own notifications
      tags: [Notifications]
      security:
        - BearerAuth: []
      parameters:
        - name: unread_only
          in: query
          schema: { type: boolean }
        - name: page
          in: query
          schema: { type: integer }
      responses:
        '200': { description: Notification list }

  /notifications/read-all:
    post:
      summary: Mark all notifications as read
      tags: [Notifications]
      security:
        - BearerAuth: []
      responses:
        '200': { description: All marked read }

  # ─── Blog ─────────────────────────────────────────────────────────────────────
  /blog/posts:
    get:
      summary: List published blog posts
      tags: [Blog]
      security: []
      parameters:
        - name: category
          in: query
          schema: { type: string }
        - name: speciality
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer }
        - name: limit
          in: query
          schema: { type: integer }
      responses:
        '200': { description: Blog post list }

  /blog/posts/{slug}:
    get:
      summary: Get blog post by slug
      tags: [Blog]
      security: []
      parameters:
        - name: slug
          in: path
          required: true
          schema: { type: string }
      responses:
        '200': { description: Blog post detail }
        '404': { description: Post not found or not published }

  # ─── Pharmacy ─────────────────────────────────────────────────────────────────
  /pharmacy/products:
    get:
      summary: List pharmacy products
      tags: [Pharmacy]
      security: []
      parameters:
        - name: q
          in: query
          schema: { type: string }
        - name: category
          in: query
          schema: { type: string }
        - name: prescription_required
          in: query
          schema: { type: boolean }
        - name: page
          in: query
          schema: { type: integer }
      responses:
        '200': { description: Product list }

  /pharmacy/orders:
    post:
      summary: Place pharmacy order
      tags: [Pharmacy]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [items, deliveryAddress]
              properties:
                items:
                  type: string
                  description: JSON array of {productId, qty}
                deliveryAddress:
                  type: string
                  description: JSON object with address fields
                couponCode: { type: string }
                prescriptionFile:
                  type: string
                  format: binary
                  description: Required if any item needs prescription
      responses:
        '201': { description: Order placed }

  /pharmacy/orders/{id}:
    get:
      summary: Get pharmacy order status
      tags: [Pharmacy]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200': { description: Order detail }

  # ─── Patient Profile ──────────────────────────────────────────────────────────
  /patients/me/profile:
    get:
      summary: Get own patient profile
      tags: [Patients]
      security:
        - BearerAuth: []
      responses:
        '200': { description: Patient profile }

    patch:
      summary: Update own patient profile
      tags: [Patients]
      security:
        - BearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                dob: { type: string, format: date }
                bloodGroup: { type: string }
                gender: { type: string }
                allergies: { type: array, items: { type: string } }
                chronicConditions: { type: array, items: { type: string } }
      responses:
        '200': { description: Profile updated }

  /patients/me/family-members:
    get:
      summary: List family members
      tags: [Patients]
      security:
        - BearerAuth: []
      responses:
        '200': { description: Family member list }

    post:
      summary: Add family member
      tags: [Patients]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, relation, dob, gender]
              properties:
                name: { type: string }
                relation:
                  type: string
                  enum: [SPOUSE, CHILD, PARENT, SIBLING, OTHER]
                dob: { type: string, format: date }
                gender: { type: string }
                bloodGroup: { type: string }
                allergies: { type: array, items: { type: string } }
      responses:
        '201': { description: Family member added }
        '422':
          description: Maximum 5 family members reached

  /patients/me/data-export:
    get:
      summary: Export all personal data (GDPR)
      tags: [Patients]
      security:
        - BearerAuth: []
      responses:
        '202':
          description: Export queued. Download link sent via email within 24h.
```

---

## 3. WebSocket Events (Socket.IO)

### Connection
```
ws://api.docnear.in/v1?token=<access_token>
```

### Rooms
| Room | Joined by | Description |
|------|-----------|-------------|
| `doctor:{doctorId}` | Doctor on login | Receives new booking notifications |
| `booking:{bookingId}` | Both parties | Booking status updates |
| `consult:{bookingId}` | Both parties | Video consult signaling |

### Server → Client Events

| Event | Room | Payload | Trigger |
|-------|------|---------|---------|
| `booking:new` | `doctor:{id}` | `{booking}` | Patient books with doctor |
| `booking:confirmed` | `booking:{id}` | `{booking}` | Payment webhook received |
| `booking:cancelled` | `booking:{id}` | `{bookingId, reason}` | Cancellation |
| `booking:in_progress` | `booking:{id}` | `{bookingId}` | Doctor starts consult |
| `booking:completed` | `booking:{id}` | `{bookingId}` | Doctor ends consult |
| `consult:room_ready` | `consult:{id}` | `{roomCode}` | Video room created |
| `prescription:ready` | `booking:{id}` | `{pdfUrl}` | Prescription finalized |

### Client → Server Events

| Event | Sender | Payload | Effect |
|-------|--------|---------|--------|
| `booking:start_consult` | Doctor | `{bookingId}` | Status → IN_PROGRESS |
| `booking:end_consult` | Doctor | `{bookingId}` | Status → COMPLETED |
| `consult:join` | Both | `{bookingId}` | Returns room code |
