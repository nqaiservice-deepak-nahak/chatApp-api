import AppLogger from '@app/core/loggers/app-logger';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Attaches the current request to the logger so downstream log lines can
 * be correlated to a request if needed.
 */
@Injectable()
export class RequestHandler implements NestInterceptor {
  constructor(private readonly _appLogger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    this._appLogger.setRequest(request);
    return next.handle();
  }
}
