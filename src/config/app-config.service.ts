import { AppConfig, EnvConfig } from '@app/config/app-config.model';
import { Injectable } from '@nestjs/common';

@Injectable()
class AppConfigService {
  private readonly envConfig: { [key: string]: any } = {} as EnvConfig;

  constructor() {
    /*app configurations*/
    this.envConfig[AppConfig.APP] = {
      port: parseInt(process.env.APP_PORT, 10),
      environment: process.env.ENVIRONMENT,
      uiUrl: process.env.UI_URL
    };

    /*database*/
    this.envConfig[AppConfig.DB] = {
      mongo: {
        uri: process.env.MONGO_CONNECTION_STRING,
        isSync: parseInt(process.env.MONGO_SYNC_BIT, 10)
      }
    };

    /*logger*/
    this.envConfig[AppConfig.LOGGER] = {
      logLevel: process.env.LOG_LEVEL
    };

    /*jwt*/
    this.envConfig[AppConfig.JWT] = {
      accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
      accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
      refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
      refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN
    };

    this.envConfig[AppConfig.AES_KEY]={
      aes_key:process.env.AES_KEY
    }
  }

  get<T extends keyof EnvConfig>(key: T): EnvConfig[T] {
    return this.envConfig[key];
  }
}

export { AppConfig, AppConfigService };
