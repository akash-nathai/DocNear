import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Encryption (AES-256 — 64 hex chars = 32 bytes)
  ENCRYPTION_KEY: Joi.string().length(64).required(),

  // Meilisearch (optional — search degrades gracefully if not configured)
  MEILISEARCH_HOST: Joi.string().default('http://localhost:7700'),
  MEILISEARCH_API_KEY: Joi.string().allow('').default(''),

  // S3 / MinIO (optional — file uploads disabled if not configured)
  S3_ENDPOINT: Joi.string().allow('').default(''),
  S3_ACCESS_KEY: Joi.string().allow('').default(''),
  S3_SECRET_KEY: Joi.string().allow('').default(''),
  S3_BUCKET: Joi.string().allow('').default('docnear'),
  S3_REGION: Joi.string().default('ap-south-1'),

  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),

  // Notifications (all optional — stubs in dev)
  MSG91_AUTH_KEY: Joi.string().default(''),
  MSG91_SENDER_ID: Joi.string().default('DOCNEAR'),
  MSG91_OTP_TEMPLATE_ID: Joi.string().default(''),
  SENDGRID_API_KEY: Joi.string().default(''),
  SENDGRID_FROM_EMAIL: Joi.string().email().default('noreply@docnear.in'),
  FCM_PROJECT_ID: Joi.string().default(''),
  FCM_CLIENT_EMAIL: Joi.string().default(''),
  FCM_PRIVATE_KEY: Joi.string().default(''),

  // Google OAuth (optional in development — set to enable Google sign-in)
  GOOGLE_CLIENT_ID: Joi.string().default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().default(''),
  GOOGLE_CALLBACK_URL: Joi.string().uri().default('http://localhost:4000/v1/auth/google/callback'),

  // Sentry
  SENTRY_DSN: Joi.string().uri().allow('').default(''),

  // Seed
  SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
});
