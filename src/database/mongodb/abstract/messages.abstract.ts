import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';
import { IMessage } from '../../schemas';

export abstract class AbstractMessagesDao {
  abstract createMessage(messageInfo: IMessage): Promise<AppResponse>;
  abstract getChatHistory(groupId: Types.ObjectId,joinedAt: string,offset: number,limit: number): Promise<AppResponse>;
  abstract getPrivateChatHistory(userId1: Types.ObjectId, userId2: Types.ObjectId): Promise<AppResponse>;
}
