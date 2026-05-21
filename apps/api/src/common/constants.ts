export const SLOT_LOCK_TTL_SECONDS = 360; // 6 minutes
export const OTP_TTL_SECONDS = 600;       // 10 minutes
export const MAX_FAMILY_MEMBERS = 5;
export const BOOKING_REF_PREFIX = 'DOC';
export const PLATFORM_COMMISSION_PERCENT = 15;
export const MIN_PAYOUT_AMOUNT_PAISE = 50_000; // ₹500

export const REDIS_KEYS = {
  slotLock: (doctorId: string, isoDatetime: string) =>
    `slot:lock:${doctorId}:${isoDatetime}`,
  bookedSlots: (doctorId: string, date: string) =>
    `booked_slots:${doctorId}:${date}`,
  session: (jti: string) => `session:${jti}`,
  otp: (phoneHash: string) => `otp:${phoneHash}`,
  doctorProfile: (doctorId: string) => `doctor:profile:${doctorId}`,
  availableSlots: (doctorId: string, date: string) =>
    `slots:available:${doctorId}:${date}`,
  specialities: () => 'specialities:all',
  cities: () => 'cities:all',
  rateLimit: (key: string, endpoint: string) => `ratelimit:${key}:${endpoint}`,
} as const;
