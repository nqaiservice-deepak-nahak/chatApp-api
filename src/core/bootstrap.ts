import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import AppLogger from '@app/core/loggers/app-logger';
import { ErrorHandler } from '@app/core/middleware/error-handler';
import { RequestHandler } from '@app/core/middleware/request-handler';
import { ResponseHandler } from '@app/core/middleware/response-handler';
import { setUpSwagger } from '@app/core/swagger/doc.swagger';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';

/**
 * Core bootstrap. All cross-cutting app-level wiring (prefix, CORS, helmet,
 * validation, interceptors, filters, swagger) lives here - mirrors the
 * reference project's core/bootstrap.ts.
 */
export default async function bootstrap(app: INestApplication, appConfigSvcObj: AppConfigService) {
  /*global-prefix*/
  app.setGlobalPrefix('api');

  /*security headers*/
  app.use(helmet());

  /*limit request body size*/
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  /*CORS - allow the configured frontend origin*/
  const { uiUrl } = appConfigSvcObj.get(AppConfig.APP);
  app.enableCors({
    origin: [uiUrl],
    credentials: true
  });

  /*auto-validation - global validation pipe*/
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  /*bind interceptors*/
  app.useGlobalInterceptors(new ResponseHandler());
  app.useGlobalInterceptors(new RequestHandler(app.get(AppLogger)));

  /*global error handler*/
  app.useGlobalFilters(new ErrorHandler(app.get(AppLogger)));

  /*swagger document - available outside production*/
  const { environment } = appConfigSvcObj.get(AppConfig.APP);
  if (environment && environment.toLowerCase() !== 'production') {
    setUpSwagger(app);
  }
}
