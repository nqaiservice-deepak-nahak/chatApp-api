import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';
import { IGroup } from '../../schemas';

export abstract class AbstractGroupsDao {
  abstract createGroup(groupInfo: IGroup): Promise<AppResponse>;
  abstract findGroupById(groupId: string): Promise<AppResponse>;
  abstract getMyGroups(userId: Types.ObjectId): Promise<AppResponse>;
  abstract getAvailableGroups(userId: Types.ObjectId): Promise<AppResponse>;
  abstract isMember(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse>;
  abstract addMember(groupId: Types.ObjectId, userId: Types.ObjectId, userName: string): Promise<AppResponse>;
  abstract getMemberCount(groupId: Types.ObjectId): Promise<AppResponse>;
  abstract markGroupAsRead(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse>;
}
