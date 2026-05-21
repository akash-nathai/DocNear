import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler} from '@nestjs/common';
import {
  Injectable
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true as const,
        data,
      })),
    );
  }
}
