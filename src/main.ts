import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import coreBootstrap from '@app/core/bootstrap';
import AppLogger from '@app/core/loggers/app-logger';
import { AppModule } from '@app/modules/app/app.module';
import { messageFactory, messages } from '@app/shared/messages.shared';
import { HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configObj = app.get(AppConfigService);
  const logger = app.get(AppLogger);
  const { port: appPort, environment } = configObj.get(AppConfig.APP);

  const port = Number(process.env.PORT) || appPort;

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error(__filename, 'unhandledRejection', HttpStatus.INTERNAL_SERVER_ERROR, reason);
  });

  try {
    await coreBootstrap(app, configObj);

    await app.listen(port,'0.0.0.0',() => {
      logger.info(__filename, bootstrap.name, HttpStatus.OK, messageFactory(messages.S1, [`${port} (${environment})`]));
    });
  } catch (err) {
    logger.error(__filename, bootstrap.name, HttpStatus.INTERNAL_SERVER_ERROR, messageFactory(messages.E1, [err.message]));
  }
}

bootstrap();
