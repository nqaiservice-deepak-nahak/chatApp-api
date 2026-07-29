import AppLogger from '@app/core/loggers/app-logger';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { GroupMembers_Keys, Groups_Keys, IGroup, IGroupMember } from '../../schemas';
import { AbstractGroupsDao } from '../abstract/groups.abstract';
import { MongoConstants } from '../connection/constants.mongo';
import { AbstractMessagesDao } from '../abstract/messages.abstract';
import { currentDate } from '@app/core/utils/timestamp-util';

@Injectable()
export class GroupsDao implements AbstractGroupsDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(MongoConstants.GROUPS_SCHEMA) private readonly _groupsSchema: Model<IGroup>,
    @Inject(MongoConstants.GROUP_MEMBERS_SCHEMA) private readonly _groupMembersSchema: Model<IGroupMember>,
    @Inject(AbstractMessagesDao) private readonly _messagesDao: AbstractMessagesDao
  ) { }

  //#region Create Group
  async createGroup(groupInfo: IGroup): Promise<AppResponse> {
    try {
      const group = new this._groupsSchema(groupInfo);
      await group.save();
      return createResponse(HttpStatus.CREATED, messages.S6, group);
    } catch (error) {
      this._loggerSvc.error(__filename, this.createGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Create Group

  //#region Find Group by Id
  async findGroupById(groupId: string): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11, null);
      const group = await this._groupsSchema.findById(groupId);
      if (!group) return createResponse(HttpStatus.NOT_FOUND, messages.W5, null);
      return createResponse(HttpStatus.OK, messages.S3, group);
    } catch (error) {
      this._loggerSvc.error(__filename, this.findGroupById.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Find Group by Id

  //#region Get My Groups (groups the user has joined)
  async getMyGroups(userId: Types.ObjectId): Promise<AppResponse> {
    try {
      const memberships = await this._groupMembersSchema.find({ [GroupMembers_Keys.UserId]: userId });
      const groupIds = memberships.map((m) => m[GroupMembers_Keys.GroupId]);
      const groups = await this._groupsSchema.find({ [Groups_Keys.id]: { $in: groupIds } }).sort({ [Groups_Keys.CreatedOn]: -1 });

      const joinedAtByGroup = new Map(memberships.map((m) => [m[GroupMembers_Keys.GroupId].toString(), m[GroupMembers_Keys.JoinedAt]]));
      const lastReadByGroup = new Map(memberships.map((m) => [m[GroupMembers_Keys.GroupId].toString(), m[GroupMembers_Keys.LastReadAt]]));

      // Enrich each group with unread data
      const enrichedGroups = await Promise.all(groups.map(async (g: any) => {
        const groupIdStr = g._id.toString();
        // Fallback to joinedAt if lastReadAt is null (handles pre-migration data)
        const since = lastReadByGroup.get(groupIdStr) ?? joinedAtByGroup.get(groupIdStr)!;

        // Fetch unread count + last 3 messages
        const [countRes, previewRes] = await Promise.all([
          this._messagesDao.getUnreadCountForGroup(g._id, since),
          this._messagesDao.getLastUnreadMessagesForGroup(g._id, since, 3)
        ]);

        return {
          ...g.toObject(),
          joinedAt: joinedAtByGroup.get(groupIdStr),
          lastReadAt: lastReadByGroup.get(groupIdStr) ?? null,
          unreadCount: countRes.data ?? 0,
          unreadPreview: previewRes.data ?? []
        };
      }));

      return createResponse(HttpStatus.OK, messages.S8, enrichedGroups);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get My Groups

  //#region Get Available Groups (groups the user has NOT joined)
  async getAvailableGroups(userId: Types.ObjectId): Promise<AppResponse> {
    try {
      const memberships = await this._groupMembersSchema.find({ [GroupMembers_Keys.UserId]: userId });
      const joinedGroupIds = memberships.map((m) => m[GroupMembers_Keys.GroupId]);
      const groups = await this._groupsSchema
        .find({ [Groups_Keys.id]: { $nin: joinedGroupIds } })
        .sort({ [Groups_Keys.CreatedOn]: -1 });

      return createResponse(HttpStatus.OK, messages.S8, groups);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Available Groups

  //#region Check Membership
  async isMember(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse> {
    try {
      const membership = await this._groupMembersSchema.findOne({
        [GroupMembers_Keys.GroupId]: groupId,
        [GroupMembers_Keys.UserId]: userId
      });
      return createResponse(HttpStatus.OK, messages.S3, membership);
    } catch (error) {
      this._loggerSvc.error(__filename, this.isMember.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Check Membership

  //#region Add Member (join group)
  async addMember(groupId: Types.ObjectId, userId: Types.ObjectId, userName: string): Promise<AppResponse> {
    try {
      const member = new this._groupMembersSchema({
        [GroupMembers_Keys.GroupId]: groupId,
        [GroupMembers_Keys.UserId]: userId,
        [GroupMembers_Keys.UserName]: userName,
        [GroupMembers_Keys.LastReadAt]: currentDate()
      });
      await member.save();
      return createResponse(HttpStatus.CREATED, messages.S7, member);
    } catch (error) {
      /*duplicate key -> already a member*/
      if (error?.code === 11000) return createResponse(HttpStatus.CONFLICT, messages.W8, null);
      this._loggerSvc.error(__filename, this.addMember.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Add Member

  //#region Get Member Count
  async getMemberCount(groupId: Types.ObjectId): Promise<AppResponse> {
    try {
      const count = await this._groupMembersSchema.countDocuments({ [GroupMembers_Keys.GroupId]: groupId });
      return createResponse(HttpStatus.OK, messages.S3, count);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMemberCount.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Member Count


  //#region Mark Group As Read
  async markGroupAsRead(groupId: Types.ObjectId, userId: Types.ObjectId): Promise<AppResponse> {
    try {
      const updated = await this._groupMembersSchema.findOneAndUpdate(
        { [GroupMembers_Keys.GroupId]: groupId, [GroupMembers_Keys.UserId]: userId },
        { $set: { [GroupMembers_Keys.LastReadAt]: currentDate() } },
        { new: true }
      );
      return createResponse(HttpStatus.OK, messages.S3, updated);
    } catch (error) {
      this._loggerSvc.error(__filename, this.markGroupAsRead.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Mark Group As Read
}
