import { AppResponse } from '@app/shared/app-response.shared';
import { Types } from 'mongoose';
import { IGroup } from '../../schemas';

export abstract class AbstractGroupsDao {
  abstract createGroup(groupInfo: IGroup): Promise<AppResponse>;
  abstract findGroupById(groupId: string): Promise<AppResponse>;
  abstract getMyGroups(
    userId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse>;
  abstract getAvailableGroups(
    userId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse>;
  /** Search public groups by name, excluding groups the user has already joined. */
  abstract searchPublicGroups(userId: Types.ObjectId, query: string): Promise<AppResponse>;
  abstract isMember(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse>;
  abstract addMember(groupId: Types.ObjectId, userId: Types.ObjectId, userName: string): Promise<AppResponse>;
  abstract getMemberCount(groupId: Types.ObjectId): Promise<AppResponse>;
  abstract markGroupAsRead(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse>;
  /** Returns list of user IDs that are already members of this group (helper for dedupe). */
  abstract getMemberUserIds(groupId: Types.ObjectId): Promise<AppResponse>;
  /** Returns member IDs and display names for real-time group presence. */
  abstract getGroupMembers(groupId: Types.ObjectId): Promise<AppResponse>;
  /** Returns users not yet in this group, to choose from when adding members. */
  abstract getAvailableMembersForGroup(
    groupId: Types.ObjectId,
    callerUserId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse>;
  abstract removeMember(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse>;
  abstract deleteGroup(groupId: Types.ObjectId, creatorId: Types.ObjectId): Promise<AppResponse>;
  /** Atomically update createdBy / createdByName for a group. */
  abstract transferGroupOwnership(
    groupId: Types.ObjectId,
    currentOwnerId: Types.ObjectId,
    newOwnerId: Types.ObjectId,
    newOwnerName: string
  ): Promise<AppResponse>;
}
