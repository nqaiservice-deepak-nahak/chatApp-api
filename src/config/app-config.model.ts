const enum AppConfig {
  APP = 'app',
  DB = 'db',
  LOGGER = 'logger',
  JWT = 'jwt'
}

interface EnvConfig {
  [AppConfig.APP]: {
    port: number;
    environment: string;
    uiUrl: string;
  };
  [AppConfig.DB]: {
    mongo: {
      uri: string;
      isSync: number;
    };
  };
  [AppConfig.LOGGER]: {
    logLevel: string;
  };
  [AppConfig.JWT]: {
    accessTokenSecret: string;
    accessTokenExpiresIn: string;
  };
}

export { AppConfig, EnvConfig };
