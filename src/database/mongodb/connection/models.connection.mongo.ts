import { Connection } from 'mongoose';
import {
  createDirectChatMetaSchema,
  createGroupMembersSchema,
  createGroupsSchema,
  createMessagesSchema,
  createUsersSchema
} from '../../schemas';
import { Collections } from './collections.mongo';
import { MongoConstants } from './constants.mongo';

export const mongoDbModelsProvider = [
  {
    provide: MongoConstants.USERS_SCHEMA,
    useFactory: (connection: Connection) => createUsersSchema(connection),
    inject: [MongoConstants.MONGO_DB_PROVIDER],
    modelNames: Collections.Users
  },
  {
    provide: MongoConstants.GROUPS_SCHEMA,
    useFactory: (connection: Connection) => createGroupsSchema(connection),
    inject: [MongoConstants.MONGO_DB_PROVIDER],
    modelNames: Collections.Groups
  },
  {
    provide: MongoConstants.GROUP_MEMBERS_SCHEMA,
    useFactory: (connection: Connection) => createGroupMembersSchema(connection),
    inject: [MongoConstants.MONGO_DB_PROVIDER],
    modelNames: Collections.GroupMembers
  },
  {
    provide: MongoConstants.MESSAGES_SCHEMA,
    useFactory: (connection: Connection) => createMessagesSchema(connection),
    inject: [MongoConstants.MONGO_DB_PROVIDER],
    modelNames: Collections.Messages
  },
  {
    provide: MongoConstants.DIRECT_CHAT_META_SCHEMA,
    useFactory: (connection: Connection) => createDirectChatMetaSchema(connection),
    inject: [MongoConstants.MONGO_DB_PROVIDER],
    modelNames: Collections.DirectChatMeta
  }
];
