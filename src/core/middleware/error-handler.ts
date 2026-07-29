import AppLogger from '@app/core/loggers/app-logger';
import { messages } from '@app/shared/messages.shared';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

/**
 * Centralized error handling - every unhandled exception funnels through here
 * and is normalized into the same {code, message, description} response shape.
 */
@Catch()
export class ErrorHandler implements ExceptionFilter {
  constructor(private readonly _logger: AppLogger) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const err_desc: any = typeof exception.getResponse === 'function' ? exception.getResponse() : undefined;
    let err_response: any, status: number;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      err_response = {
        code: err_desc?.code ?? exception.getStatus(),
        message: err_desc?.message ?? exception.message,
        description: err_desc?.description ?? undefined
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      err_response = {
        code: status,
        message: messages.E2
      };
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this._logger.error(__filename, ErrorHandler.name, status, exception.stack);
    else this._logger.log(__filename, ErrorHandler.name, status, exception.message);

    res.status(status).json(err_response);
  }
}
