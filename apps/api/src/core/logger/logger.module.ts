import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get('nodeEnv') === 'development';
        return {
          pinoHttp: {
            level: isDev ? 'debug' : 'info',
            transport: isDev
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
            // Never log these request headers / body fields
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.otp',
              'req.body.accountNumber',
            ],
            autoLogging: {
              ignore: req => req.url === '/v1/health' || req.url === '/v1/health/ready',
            },
            serializers: {
              req(req: { method: string; url: string; id: string }) {
                return { method: req.method, url: req.url, id: req.id };
              },
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
