/**
 * DocNear — k6 Load Test: Concurrent slot booking
 *
 * Target:
 *   - 500 concurrent VUs all booking the same slot → exactly 1 wins, 499 get 409
 *   - p95 response time < 500ms for POST /v1/bookings
 *   - Zero data corruption (verified via DB query after test)
 *
 * Usage:
 *   k6 run infra/k6/booking-load-test.js \
 *     -e API_URL=http://localhost:4000/v1 \
 *     -e ACCESS_TOKEN=<patient_jwt>
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const successfulBookings = new Counter('successful_bookings');
const conflictResponses  = new Counter('conflict_responses_409');
const bookingDuration    = new Trend('booking_duration_ms', true);
const errorRate          = new Rate('error_rate');

// ── Test config ───────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    concurrent_slot_booking: {
      executor: 'shared-iterations',
      vus: 500,
      iterations: 500,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // p95 booking response < 500ms
    booking_duration_ms: ['p(95)<500'],
    // At most 1 successful booking (1 VU wins the slot race)
    successful_bookings: ['count<=1'],
    // All others must get 409
    conflict_responses_409: ['count>=499'],
    // Zero unexpected errors
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL     = __ENV.API_URL    || 'http://localhost:4000/v1';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const DOCTOR_SLUG  = __ENV.DOCTOR_SLUG  || 'dr-ananya-krishnamurthy';
const SLOT_DATETIME = __ENV.SLOT_DATETIME || '2026-06-15T09:00:00.000Z';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
};

// ── Main test function ─────────────────────────────────────────────────────────
export default function () {
  const payload = JSON.stringify({
    doctorSlug:   DOCTOR_SLUG,
    slotDatetime: SLOT_DATETIME,
    consultType:  'VIDEO',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/bookings`, payload, { headers });
  const elapsed = Date.now() - start;

  bookingDuration.add(elapsed);

  if (res.status === 200 || res.status === 201) {
    successfulBookings.add(1);
    check(res, { 'booking created': r => r.status === 201 || r.status === 200 });
  } else if (res.status === 409) {
    conflictResponses.add(1);
    check(res, { '409 conflict (expected)': r => r.status === 409 });
  } else {
    errorRate.add(1);
    console.error(`Unexpected status ${res.status}: ${res.body}`);
  }

  sleep(0.1);
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  return {
    'infra/k6/results/booking-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════╗
║         DocNear Concurrent Booking Load Test             ║
╠══════════════════════════════════════════════════════════╣
║  Successful bookings : ${data.metrics.successful_bookings?.values?.count ?? 0} (expected: 1)          ║
║  409 Conflicts       : ${data.metrics.conflict_responses_409?.values?.count ?? 0} (expected: 499)        ║
║  p95 duration (ms)   : ${data.metrics.booking_duration_ms?.values?.['p(95)'] ?? '?'}                    ║
╚══════════════════════════════════════════════════════════╝
`,
  };
}
