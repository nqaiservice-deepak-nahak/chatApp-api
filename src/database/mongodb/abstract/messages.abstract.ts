import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';
import { IMessage } from '../../schemas';

export abstract class AbstractMessagesDao {
  abstract createMessage(messageInfo: IMessage): Promise<AppResponse>;
  abstract getChatHistory(groupId: Types.ObjectId,joinedAt: string,offset: number,limit: number): Promise<AppResponse>;
  abstract getPrivateChatHistory(userId1: Types.ObjectId, userId2: Types.ObjectId, offset: number, limit: number): Promise<AppResponse>;
  abstract getUnreadCountForGroup(
    groupId: Types.ObjectId,
    sinceTimestamp: string,
    viewerId?: Types.ObjectId,
  ): Promise<AppResponse>;
  abstract getLastUnreadMessagesForGroup(
    groupId: Types.ObjectId,
    sinceTimestamp: string,
    limit: number,
    viewerId?: Types.ObjectId,
  ): Promise<AppResponse>;
  abstract getUnreadCountForPrivateChat(
    viewerId: Types.ObjectId,
    otherId: Types.ObjectId,
    sinceTimestamp: string
  ): Promise<AppResponse>;
  abstract getLastUnreadMessagesForPrivateChat(
    viewerId: Types.ObjectId,
    otherId: Types.ObjectId,
    sinceTimestamp: string,
    limit: number
  ): Promise<AppResponse>;
}
