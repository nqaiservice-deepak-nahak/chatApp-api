import { AppConfigService } from '@app/config/app-config.service';
import { AuthGuard } from '@app/core/guards/authorization.guard';
import AppLogger from '@app/core/loggers/app-logger';
import { DatabaseModule } from '@app/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

const getProviders = (): any[] => {
    return [AppConfigService, AppLogger, { provide: APP_GUARD, useClass: AuthGuard }];
  },
  importProviders = (): any[] => {
    return [ConfigModule.forRoot({ envFilePath:'.env.prod' }), DatabaseModule, JwtModule.register({ global: true })];
  },
  exportProviders = (): any[] => {
    return [AppConfigService, AppLogger, DatabaseModule, JwtModule];
  };

export { exportProviders, getProviders, importProviders };
