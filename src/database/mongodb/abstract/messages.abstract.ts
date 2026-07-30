import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';
import { IMessage } from '../../schemas';

export abstract class AbstractMessagesDao {
  abstract createMessage(messageInfo: IMessage): Promise<AppResponse>;
  abstract getChatHistory(chatId: string, joinedAt: string, offset: number, limit: number): Promise<AppResponse>;
  abstract getPrivateChatHistory(chatId: string, offset: number, limit: number): Promise<AppResponse>;
  abstract getChatHistoryByChatId(chatId: string, joinedAt: string, offset: number, limit: number): Promise<AppResponse>;
  abstract getPrivateChatHistoryByChatId(chatId: string, offset: number, limit: number): Promise<AppResponse>;
  abstract getUnreadCountForGroup(
    chatId: string,
    sinceTimestamp: string,
    viewerId?: Types.ObjectId,
  ): Promise<AppResponse>;
  abstract getLastUnreadMessagesForGroup(
    chatId: string,
    sinceTimestamp: string,
    limit: number,
    viewerId?: Types.ObjectId,
  ): Promise<AppResponse>;
  abstract getUnreadCountForPrivateChat(
    chatId: string,
    viewerId: Types.ObjectId,
    sinceTimestamp: string
  ): Promise<AppResponse>;
  abstract getLastUnreadMessagesForPrivateChat(
    chatId: string,
    viewerId: Types.ObjectId,
    sinceTimestamp: string,
    limit: number
  ): Promise<AppResponse>;
}
