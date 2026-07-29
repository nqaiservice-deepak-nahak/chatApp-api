import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import AppLogger from '@app/core/loggers/app-logger';
import { messageFactory, messages } from '@app/shared/messages.shared';
import { HttpStatus } from '@nestjs/common';
import { Connection, createConnection } from 'mongoose';
import { MongoConstants } from './constants.mongo';

/**
 * Factory provider that opens (and manages) a single Mongoose connection for
 * the whole application. All schema-model providers depend on this.
 */
export const mongoDbProvider = [
  {
    provide: MongoConstants.MONGO_DB_PROVIDER,
    useFactory: async (configService: AppConfigService, _logger: AppLogger): Promise<Connection> => {
      const dbCred = configService.get(AppConfig.DB)?.mongo;
      const conn = createConnection(dbCred.uri, {
        autoCreate: Boolean(dbCred?.isSync),
        autoIndex: Boolean(dbCred?.isSync)
      });

      conn.on('connected', () => {
        _logger.log(__filename, 'mongoDbProvider', HttpStatus.OK, messages.S2);
      });

      conn.on('error', (err) => {
        _logger.error(__filename, 'mongoDbProvider', HttpStatus.INTERNAL_SERVER_ERROR, messageFactory(messages.E4, [err.message]));
      });

      conn.on('disconnected', () => {
        _logger.error(__filename, 'mongoDbProvider', HttpStatus.INTERNAL_SERVER_ERROR, messages.E5);
      });

      process.on('SIGINT', async () => {
        await conn.close();
        process.exit(0);
      });

      await conn.asPromise();
      return conn;
    },
    inject: [AppConfigService, AppLogger]
  }
];
