import { Connection, Document, Schema, SchemaTypes, Types } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
const enum Messages_Keys {
  id = '_id',
  GroupId = 'groupId',
  ReceiverId = 'receiverId',
  SenderId = 'senderId',
  SenderName = 'senderName',
  Message = 'message',
  MessageType = 'messageType',
  CreatedOn = 'createdOn'
}
//#endregion Keys

//#region Interfaces
interface IMessage {
  [Messages_Keys.GroupId]?: Types.ObjectId;
  [Messages_Keys.ReceiverId]?: Types.ObjectId;
  [Messages_Keys.SenderId]: Types.ObjectId;
  [Messages_Keys.SenderName]: string;
  [Messages_Keys.Message]: string;
  [Messages_Keys.MessageType]: 'group' | 'private';
  [Messages_Keys.CreatedOn]: string;
}

interface IMessagesModel extends IMessage, Document { }
//#endregion Interfaces

//#region Schema
const MessagesSchema = new Schema<IMessagesModel>({
  [Messages_Keys.GroupId]: { type: SchemaTypes.ObjectId, ref: Collections.Groups, required: false },
  [Messages_Keys.ReceiverId]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: false },
  [Messages_Keys.SenderId]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [Messages_Keys.SenderName]: { type: SchemaTypes.String, required: true },
  [Messages_Keys.Message]: { type: SchemaTypes.String, required: true },
  [Messages_Keys.MessageType]: { type: SchemaTypes.String, required: true, default: 'group', enum: ['group', 'private'] },
  [Messages_Keys.CreatedOn]: { type: SchemaTypes.String, required: true, default: () => currentDate() }
});

/** Conditional validation: groupId required for group msgs; receiverId required for private msgs. */
MessagesSchema.pre('validate', function (next) {
  const msg = this as unknown as IMessage;
  if (msg[Messages_Keys.MessageType] === 'group') {
    if (!msg[Messages_Keys.GroupId]) {
      next(new Error(`groupId is required for messageType='group'`));
      return;
    }
  } else if (msg[Messages_Keys.MessageType] === 'private') {
    if (!msg[Messages_Keys.ReceiverId]) {
      next(new Error(`receiverId is required for messageType='private'`));
      return;
    }
  }
  next();
});
//#endregion Schema

//#region Indexes
// Group chat history + unread lookups (by group, newest first)
MessagesSchema.index({ [Messages_Keys.GroupId]: 1, [Messages_Keys.CreatedOn]: 1 });
// Private chat history lookups: (A,B) OR (B,A) conversations sorted by time
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.ReceiverId]: 1,
  [Messages_Keys.CreatedOn]: 1
});
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.ReceiverId]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.CreatedOn]: 1
});
// Unread queries: count messages from a specific sender since a timestamp
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.CreatedOn]: 1
});
//#endregion Indexes

const createMessagesSchema = (conn: Connection) => conn.model<IMessagesModel>(Collections.Messages, MessagesSchema, Collections.Messages);

export { createMessagesSchema, IMessage, IMessagesModel, Messages_Keys, MessagesSchema };
