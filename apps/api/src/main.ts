import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // rawBody: true exposes req.rawBody as a Buffer — required for Razorpay webhook HMAC verification
    rawBody: true,
  });

  // ── Structured logging (Pino) ────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const corsOrigins = config.get<string[]>('cors.origins') ?? ['http://localhost:3000'];

  // ── Security headers ────────────────────────────────────────────────────
  app.use(helmet());

  // ── Cookie parser (required for httpOnly refresh token) ─────────────────
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  // ── Global prefix + versioning ──────────────────────────────────────────
  app.setGlobalPrefix('v1');

  // ── Global validation pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters & interceptors ────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── WebSocket (Socket.IO) adapter ────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Shutdown hooks ───────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 DocNear API running on http://localhost:${port}/v1`, 'Bootstrap');
  logger.log(`📋 Health: http://localhost:${port}/v1/health`, 'Bootstrap');
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
