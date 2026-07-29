import { mongoDbProvider } from '@app/database/mongodb/connection/connection.mongo';
import { mongoDbModelsProvider } from '@app/database/mongodb/connection/models.connection.mongo';
import { Module } from '@nestjs/common';
import { AbstractAuthDao } from './mongodb/abstract/auth.abstract';
import { AbstractGroupsDao } from './mongodb/abstract/groups.abstract';
import { AbstractMessagesDao } from './mongodb/abstract/messages.abstract';
import { AuthDao } from './mongodb/dao/auth.dao';
import { GroupsDao } from './mongodb/dao/groups.dao';
import { MessagesDao } from './mongodb/dao/messages.dao';

const daoProviders = [
  { provide: AbstractAuthDao, useClass: AuthDao },
  { provide: AbstractGroupsDao, useClass: GroupsDao },
  { provide: AbstractMessagesDao, useClass: MessagesDao }
];

@Module({
  providers: [...mongoDbProvider, ...mongoDbModelsProvider, ...daoProviders],
  exports: [...mongoDbProvider, ...mongoDbModelsProvider, ...daoProviders]
})
export class DatabaseModule {}
