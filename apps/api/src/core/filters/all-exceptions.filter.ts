import type {
  ExceptionFilter,
  ArgumentsHost} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Array<{ field: string; message: string }> = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        code = (resp['error'] as string) ?? exception.name;
        message = Array.isArray(resp['message'])
          ? 'Validation failed'
          : (resp['message'] as string) ?? exception.message;

        // Handle class-validator ValidationPipe errors
        if (Array.isArray(resp['message'])) {
          details = (resp['message'] as string[]).map(msg => {
            const [field, ...rest] = msg.split(' ');
            return { field: field ?? 'unknown', message: rest.join(' ') || msg };
          });
          code = 'VALIDATION_ERROR';
        }
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        { err: exception, traceId, url: request.url, method: request.method },
        'Unhandled exception',
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details.length > 0 && { details }),
        trace_id: traceId,
      },
    });
  }
}
