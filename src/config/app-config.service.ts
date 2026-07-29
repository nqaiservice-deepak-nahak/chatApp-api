import { AppConfig, EnvConfig } from '@app/config/app-config.model';
import { Injectable } from '@nestjs/common';

@Injectable()
class AppConfigService {
  private readonly envConfig: { [key: string]: any } = {} as EnvConfig;

  constructor() {
    /*app configurations*/
    this.envConfig[AppConfig.APP] = {
      port: parseInt(process.env.APP_PORT, 10) || 8000,
      environment: process.env.ENVIRONMENT || 'development',
      uiUrl: process.env.UI_URL || 'http://localhost:5173'
    };

    /*database*/
    this.envConfig[AppConfig.DB] = {
      mongo: {
        uri: process.env.MONGO_CONNECTION_STRING,
        isSync: parseInt(process.env.MONGO_SYNC_BIT, 10) || 1
      }
    };

    /*logger*/
    this.envConfig[AppConfig.LOGGER] = {
      logLevel: process.env.LOG_LEVEL || 'debug'
    };

    /*jwt*/
    this.envConfig[AppConfig.JWT] = {
      accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET || 'super-secret-access-token-key-change-me',
      accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1d'
    };
  }

  get<T extends keyof EnvConfig>(key: T): EnvConfig[T] {
    return this.envConfig[key];
  }
}

export { AppConfig, AppConfigService };
