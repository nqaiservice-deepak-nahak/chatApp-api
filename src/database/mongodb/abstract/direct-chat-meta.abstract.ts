import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';

export abstract class AbstractDirectChatMetaDao {
  abstract markDirectChatAsRead(userId: Types.ObjectId, otherUserId: Types.ObjectId): Promise<AppResponse>;
  abstract getMyDirectConversations(userId: Types.ObjectId): Promise<AppResponse>;
  abstract updateLastMessageCache(userId: Types.ObjectId, otherUserId: Types.ObjectId, preview: string): Promise<AppResponse>;
  /** Returns list of ObjectIds (otherUserIds) the user already has a direct meta row with. */
  abstract getExistingPartnerIds(userId: Types.ObjectId): Promise<AppResponse>;
}
