import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';

/**
 * Centralized application logger built on top of winston.
 * Kept intentionally simple (console transport only) for this project;
 * swap in additional transports (file, cloud, etc.) the same way the
 * reference project wires up extra winston transports.
 */
@Injectable()
export default class AppLogger implements LoggerService {
  public logger: Logger;
  private _currentRequest: any;

  constructor(_appConfigSvc: AppConfigService) {
    const logLevel = _appConfigSvc.get(AppConfig.LOGGER)?.logLevel || 'debug';
    const { combine, timestamp, printf, colorize } = format;

    const logFormat = combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
    );

    this.logger = createLogger({
      level: logLevel,
      format: logFormat,
      transports: [new transports.Console()]
    });
  }

  setRequest(request: any) {
    this._currentRequest = request;
  }

  private format(file: string, method: string, status: number, message: any): string {
    return `[${file}] [${method}] [${status}] ${typeof message === 'string' ? message : JSON.stringify(message)}`;
  }

  log(file: string, method: string, status: number, message?: any) {
    this.logger.info(this.format(file, method, status, message));
  }

  info(file: string, method: string, status: number, message?: any) {
    this.logger.info(this.format(file, method, status, message));
  }

  error(file: string, method: string, status: number, message?: any) {
    this.logger.error(this.format(file, method, status, message));
  }

  warn(file: string, method: string, status: number, message?: any) {
    this.logger.warn(this.format(file, method, status, message));
  }

  debug(file: string, method: string, status: number, message?: any) {
    this.logger.debug(this.format(file, method, status, message));
  }

  verbose(file: string, method: string, status: number, message?: any) {
    this.logger.verbose(this.format(file, method, status, message));
  }
}
