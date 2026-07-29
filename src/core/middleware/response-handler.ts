import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

/**
 * Reads the `code` field off the AppResponse returned by controllers/services
 * and applies it as the actual HTTP status code of the response.
 */
@Injectable()
export class ResponseHandler implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (!res.headersSent && data && typeof data === 'object' && 'code' in data) {
          res.status(data.code);
        }
        return data;
      })
    );
  }
}
