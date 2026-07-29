import { Connection, Document, Schema, SchemaTypes, Types } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
const enum DirectChatMeta_Keys {
  id = '_id',
  UserId = 'userId',
  OtherUserId = 'otherUserId',
  LastReadAt = 'lastReadAt',
  LastMessagePreview = 'lastMessagePreview',
  LastMessageAt = 'lastMessageAt'
}
//#endregion Keys

//#region Interfaces
interface IDirectChatMeta {
  [DirectChatMeta_Keys.UserId]: Types.ObjectId;
  [DirectChatMeta_Keys.OtherUserId]: Types.ObjectId;
  [DirectChatMeta_Keys.LastReadAt]: string;
  [DirectChatMeta_Keys.LastMessagePreview]?: string;
  [DirectChatMeta_Keys.LastMessageAt]?: string;
}

interface IDirectChatMetaModel extends IDirectChatMeta, Document {}
//#endregion Interfaces

//#region Schema
const DirectChatMetaSchema = new Schema<IDirectChatMetaModel>({
  [DirectChatMeta_Keys.UserId]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [DirectChatMeta_Keys.OtherUserId]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [DirectChatMeta_Keys.LastReadAt]: { type: SchemaTypes.String, required: true, default: () => currentDate() },
  [DirectChatMeta_Keys.LastMessagePreview]: { type: SchemaTypes.String, required: false },
  [DirectChatMeta_Keys.LastMessageAt]: { type: SchemaTypes.String, required: false }
});
//#endregion Schema

//#region Index
DirectChatMetaSchema.index(
  { [DirectChatMeta_Keys.UserId]: 1, [DirectChatMeta_Keys.OtherUserId]: 1 },
  { unique: true }
);
DirectChatMetaSchema.index({ [DirectChatMeta_Keys.UserId]: 1, [DirectChatMeta_Keys.LastMessageAt]: -1 });
//#endregion Index

const createDirectChatMetaSchema = (conn: Connection) =>
  conn.model<IDirectChatMetaModel>(Collections.DirectChatMeta, DirectChatMetaSchema, Collections.DirectChatMeta);

export {
  createDirectChatMetaSchema,
  DirectChatMeta_Keys,
  DirectChatMetaSchema,
  IDirectChatMeta,
  IDirectChatMetaModel
};
