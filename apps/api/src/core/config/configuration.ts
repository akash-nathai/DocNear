export const configuration = () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '4000', 10),

  database: {
    url: process.env['DATABASE_URL'],
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  jwt: {
    accessSecret: process.env['JWT_ACCESS_SECRET'],
    refreshSecret: process.env['JWT_REFRESH_SECRET'],
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  },

  encryption: {
    key: process.env['ENCRYPTION_KEY'],
  },

  meilisearch: {
    host: process.env['MEILISEARCH_HOST'] ?? 'http://localhost:7700',
    apiKey: process.env['MEILISEARCH_API_KEY'],
  },

  s3: {
    endpoint: process.env['S3_ENDPOINT'],
    accessKey: process.env['S3_ACCESS_KEY'],
    secretKey: process.env['S3_SECRET_KEY'],
    bucket: process.env['S3_BUCKET'] ?? 'docnear',
    region: process.env['S3_REGION'] ?? 'ap-south-1',
  },

  razorpay: {
    keyId: process.env['RAZORPAY_KEY_ID'],
    keySecret: process.env['RAZORPAY_KEY_SECRET'],
    webhookSecret: process.env['RAZORPAY_WEBHOOK_SECRET'],
  },

  notifications: {
    msg91AuthKey: process.env['MSG91_AUTH_KEY'] ?? '',
    msg91SenderId: process.env['MSG91_SENDER_ID'] ?? 'DOCNEAR',
    msg91OtpTemplateId: process.env['MSG91_OTP_TEMPLATE_ID'] ?? '',
    sendgridApiKey: process.env['SENDGRID_API_KEY'] ?? '',
    sendgridFromEmail: process.env['SENDGRID_FROM_EMAIL'] ?? 'noreply@docnear.in',
    fcmProjectId: process.env['FCM_PROJECT_ID'] ?? '',
    fcmClientEmail: process.env['FCM_CLIENT_EMAIL'] ?? '',
    fcmPrivateKey: process.env['FCM_PRIVATE_KEY'] ?? '',
  },

  google: {
    clientId: process.env['GOOGLE_CLIENT_ID'],
    clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    callbackUrl: process.env['GOOGLE_CALLBACK_URL'],
  },

  sentry: {
    dsn: process.env['SENTRY_DSN'] ?? '',
  },

  seed: {
    adminEmail: process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@docnear.in',
    adminPassword: process.env['SUPER_ADMIN_PASSWORD'],
  },

  cors: {
    origins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(','),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
