const enum AppConfig {
  APP = 'app',
  DB = 'db',
  LOGGER = 'logger',
  JWT = 'jwt',
  AES_KEY='aes_key'
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
    refreshTokenSecret: string;
    refreshTokenExpiresIn: string;
  };
  [AppConfig.AES_KEY]:{
    aes_key:string;
  }
}

export { AppConfig, EnvConfig };
