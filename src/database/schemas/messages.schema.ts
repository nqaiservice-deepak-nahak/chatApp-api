import { Connection, Document, Schema, SchemaTypes, Types } from "mongoose";
import { currentDate } from "../../core/utils/timestamp-util";
import { Collections } from "../mongodb/connection/collections.mongo";

//#region Keys
const enum Messages_Keys {
  id = "_id",
  ChatId = "chatId",
  GroupId = "groupId",
  ReceiverId = "receiverId",
  SenderId = "senderId",
  SenderName = "senderName",
  Message = "message",
  MessageType = "messageType",
  CreatedOn = "createdOn",
}
//#endregion Keys

//#region Interfaces
/**
 * Message content shape. Only `text` is populated for now — `imagePath` and `files`
 * are reserved for upcoming attachment support, but the object shape is already
 * in place so clients/consumers don't need another breaking change later.
 */
interface IMessageContent {
  text: string;
  imagePath?: string;
  files?: string;
}

interface IMessage {
  [Messages_Keys.ChatId]: string;
  [Messages_Keys.GroupId]?: Types.ObjectId;
  [Messages_Keys.ReceiverId]?: Types.ObjectId;
  [Messages_Keys.SenderId]: Types.ObjectId;
  [Messages_Keys.SenderName]: string;
  [Messages_Keys.Message]: IMessageContent;
  [Messages_Keys.MessageType]: "group" | "private";
  [Messages_Keys.CreatedOn]: string;
}

interface IMessagesModel extends IMessage, Document {}
//#endregion Interfaces

//#region Schema
/** Sub-document for message content. Only `text` is used today; `imagePath`/`files`
 * are here so the shape doesn't need another migration once attachments ship. */
const MessageContentSchema = new Schema<IMessageContent>(
  {
    text: { type: SchemaTypes.String, required: false, default: "" },
    imagePath: { type: SchemaTypes.String, required: false, default: "" },
    files: { type: SchemaTypes.String, required: false, default: "" },
  },
  { _id: false },
);

const MessagesSchema = new Schema<IMessagesModel>({
  [Messages_Keys.GroupId]: {
    type: SchemaTypes.ObjectId,
    ref: Collections.Groups,
    required: false,
  },
  [Messages_Keys.ReceiverId]: {
    type: SchemaTypes.ObjectId,
    ref: Collections.Users,
    required: false,
  },
  [Messages_Keys.ChatId]: {
    type: SchemaTypes.String,
    required: true,
  },
  [Messages_Keys.SenderId]: {
    type: SchemaTypes.ObjectId,
    ref: Collections.Users,
    required: true,
  },
  [Messages_Keys.SenderName]: { type: SchemaTypes.String, required: true },
  [Messages_Keys.Message]: { type: MessageContentSchema, required: true },
  [Messages_Keys.MessageType]: {
    type: SchemaTypes.String,
    required: true,
    default: "group",
    enum: ["group", "private"],
  },
  [Messages_Keys.CreatedOn]: {
    type: SchemaTypes.String,
    required: true,
    default: () => currentDate(),
  },
});

/** A message must carry a chatId; groupId/receiverId are no longer required because
 * chatId is the canonical conversation identifier. */
MessagesSchema.pre("validate", function (next) {
  const msg = this as unknown as IMessage;
  if (!msg[Messages_Keys.ChatId]) {
    next(new Error(`chatId is required for every message`));
    return;
  }

  if (!msg[Messages_Keys.SenderId]) {
    next(new Error(`senderId is required for every message`));
    return;
  }

  const content = msg[Messages_Keys.Message];
  const hasContent =
    !!content?.text?.trim() || !!content?.imagePath?.trim() || !!content?.files?.trim();
  if (!hasContent) {
    next(new Error(`message content (text, imagePath, or files) is required`));
    return;
  }

  next();
});
//#endregion Schema

//#region Indexes
// Group chat history + unread lookups (by group, newest first)
MessagesSchema.index({
  [Messages_Keys.GroupId]: 1,
  [Messages_Keys.CreatedOn]: 1,
});
// Unified chat lookup by chatId for both group and private conversations
MessagesSchema.index({
  [Messages_Keys.ChatId]: 1,
  [Messages_Keys.CreatedOn]: 1,
});
// Private chat history lookups: (A,B) OR (B,A) conversations sorted by time
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.ReceiverId]: 1,
  [Messages_Keys.CreatedOn]: 1,
});
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.ReceiverId]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.CreatedOn]: 1,
});
// Unread queries: count messages from a specific sender since a timestamp
MessagesSchema.index({
  [Messages_Keys.MessageType]: 1,
  [Messages_Keys.SenderId]: 1,
  [Messages_Keys.CreatedOn]: 1,
});
//#endregion Indexes

const createMessagesSchema = (conn: Connection) =>
  conn.model<IMessagesModel>(
    Collections.Messages,
    MessagesSchema,
    Collections.Messages,
  );

export {
  createMessagesSchema,
  IMessage,
  IMessageContent,
  IMessagesModel,
  Messages_Keys,
  MessagesSchema,
};