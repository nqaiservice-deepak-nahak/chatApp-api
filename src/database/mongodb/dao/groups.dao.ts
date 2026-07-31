import AppLogger from '@app/core/loggers/app-logger';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { GroupMembers_Keys, Groups_Keys, IGroup, IGroupMember, IMessage, Messages_Keys } from '../../schemas';
import { AbstractGroupsDao } from '../abstract/groups.abstract';
import { Collections } from '../connection/collections.mongo';
import { MongoConstants } from '../connection/constants.mongo';
import { AbstractMessagesDao } from '../abstract/messages.abstract';
import { currentDate } from '@app/core/utils/timestamp-util';

@Injectable()
export class GroupsDao implements AbstractGroupsDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(MongoConstants.GROUPS_SCHEMA) private readonly _groupsSchema: Model<IGroup>,
    @Inject(MongoConstants.GROUP_MEMBERS_SCHEMA) private readonly _groupMembersSchema: Model<IGroupMember>,
    @Inject(MongoConstants.MESSAGES_SCHEMA) private readonly _messagesSchema: Model<IMessage>,
    @Inject(AbstractMessagesDao) private readonly _messagesDao: AbstractMessagesDao
  ) { }

  private _groupChatId(groupId: string): string {
    return `group:${groupId}`;
  }

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

  //#region Get My Groups (groups the user has joined — paginated + searchable)
  async getMyGroups(
    userId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse> {
    try {
      const search = (options.search || '').trim();
      const memberships = await this._groupMembersSchema.find({ [GroupMembers_Keys.UserId]: userId });
      const groupIds = memberships.map((m) => m[GroupMembers_Keys.GroupId]);

      const query: any = { [Groups_Keys.id]: { $in: groupIds } };
      if (search) {
        query[Groups_Keys.Name] = { $regex: search, $options: 'i' };
      }

      // Count BEFORE pagination
      const totalCount = await this._groupsSchema.countDocuments(query);

      const groups = await this._groupsSchema
        .find(query)
        .sort({ [Groups_Keys.CreatedOn]: -1 })
        .skip(options.offset)
        .limit(options.limit);

      const joinedAtByGroup = new Map(memberships.map((m) => [m[GroupMembers_Keys.GroupId].toString(), m[GroupMembers_Keys.JoinedAt]]));
      const lastReadByGroup = new Map(memberships.map((m) => [m[GroupMembers_Keys.GroupId].toString(), m[GroupMembers_Keys.LastReadAt]]));

      // Enrich each group with unread data
      const enrichedGroups = await Promise.all(groups.map(async (g: any) => {
        const groupIdStr = g._id.toString();
        // Fallback to joinedAt if lastReadAt is null (handles pre-migration data)
        const since = lastReadByGroup.get(groupIdStr) ?? joinedAtByGroup.get(groupIdStr)!;

        // Fetch unread count + last 3 messages; exclude viewer's own sent msgs from count/preview
        const [countRes, previewRes] = await Promise.all([
          this._messagesDao.getUnreadCountForGroup(this._groupChatId(groupIdStr), since, userId),
          this._messagesDao.getLastUnreadMessagesForGroup(this._groupChatId(groupIdStr), since, 3, userId),
        ]);

        // The chat list also needs a preview after every message has been read.
        // `message` remains encrypted here; MessagesService decrypts it only
        // when shaping the chat-list response.
        const latestMessage = await this._messagesSchema
          .findOne({ [Messages_Keys.ChatId]: this._groupChatId(groupIdStr) })
          .sort({ [Messages_Keys.CreatedOn]: -1 })
          .select({ [Messages_Keys.Message]: 1, [Messages_Keys.CreatedOn]: 1 })
          .lean();

        return {
          ...g.toObject(),
          joinedAt: joinedAtByGroup.get(groupIdStr),
          lastReadAt: lastReadByGroup.get(groupIdStr) ?? null,
          unreadCount: countRes.data ?? 0,
          unreadPreview: previewRes.data ?? [],
          lastMessage: latestMessage ?? null
        };
      }));

      return createResponse(HttpStatus.OK, messages.S8, {
        totalCount,
        offset: options.offset,
        limit: enrichedGroups.length,
        items: enrichedGroups
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get My Groups

  //#region Get Available Groups (groups the user has NOT joined — only PUBLIC, paginated + searchable)
  async getAvailableGroups(
    userId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse> {
    try {
      const search = (options.search || '').trim();
      const memberships = await this._groupMembersSchema.find({ [GroupMembers_Keys.UserId]: userId });
      const joinedGroupIds = memberships.map((m) => m[GroupMembers_Keys.GroupId]);

      const query: any = {
        [Groups_Keys.id]: { $nin: joinedGroupIds },
        [Groups_Keys.Type]: 'public'
      };
      if (search) {
        query[Groups_Keys.Name] = { $regex: search, $options: 'i' };
      }

      const totalCount = await this._groupsSchema.countDocuments(query);
      const groups = await this._groupsSchema
        .find(query)
        .sort({ [Groups_Keys.CreatedOn]: -1 })
        .skip(options.offset)
        .limit(options.limit);

      return createResponse(HttpStatus.OK, messages.S8, {
        totalCount,
        offset: options.offset,
        limit: groups.length,
        items: groups
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Available Groups

  //#region Search Public Groups (by name, not joined yet)
  async searchPublicGroups(userId: Types.ObjectId, query: string): Promise<AppResponse> {
    try {
      const memberships = await this._groupMembersSchema.find({ [GroupMembers_Keys.UserId]: userId });
      const joinedGroupIds = memberships.map((m) => m[GroupMembers_Keys.GroupId]);
      const groups = await this._groupsSchema
        .find({
          [Groups_Keys.id]: { $nin: joinedGroupIds },
          [Groups_Keys.Type]: 'public',
          [Groups_Keys.Name]: { $regex: query, $options: 'i' }
        })
        .sort({ [Groups_Keys.CreatedOn]: -1 });

      return createResponse(HttpStatus.OK, messages.S8, groups);
    } catch (error) {
      this._loggerSvc.error(__filename, this.searchPublicGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Search Public Groups

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
      this._loggerSvc.error(__filename, this.markGroupAsRead.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Mark Group As Read

  //#region Get Member User IDs (bulk helper for addGroupMembers dedupe)
  async getMemberUserIds(groupId: Types.ObjectId): Promise<AppResponse> {
    try {
      const members = await this._groupMembersSchema
        .find({ [GroupMembers_Keys.GroupId]: groupId })
        .select(`${GroupMembers_Keys.UserId}`)
        .exec();
      const ids = members.map((m) => m[GroupMembers_Keys.UserId].toString());
      return createResponse(HttpStatus.OK, messages.S3, ids);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMemberUserIds.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get Available Members For Group
  /** Users NOT in this group yet. Excludes the caller too. Used by the "Add Members" picker UI. */
  async getAvailableMembersForGroup(
    groupId: Types.ObjectId,
    callerUserId: Types.ObjectId,
    options: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse> {
    try {
      const search = (options.search || '').trim();

      // 1. Existing members (include caller for completeness, then filter them too)
      const memberRows = await this._groupMembersSchema
        .find({ [GroupMembers_Keys.GroupId]: groupId })
        .select(`${GroupMembers_Keys.UserId}`)
        .exec();
      const excludeIds = new Set<string>(memberRows.map((m) => m[GroupMembers_Keys.UserId].toString()));
      excludeIds.add(callerUserId.toString());

      // 2. Users collection: exclude member list + caller, optionally filter by name/email
      const usersModel = this._groupMembersSchema.db.collection(Collections.Users);
      const query: any = {
        _id: { $nin: Array.from(excludeIds).map((s) => new Types.ObjectId(s)) }
      };
      if (search) {
        const regex = { $regex: search, $options: 'i' };
        query.$or = [{ name: regex }, { email: regex }];
      }

      // 3. Count BEFORE pagination + apply sort/skip/limit
      const [totalCount, available] = await Promise.all([
        usersModel.countDocuments(query),
        usersModel
          .find(query)
          .project({
            [GroupMembers_Keys.UserName]: 1,
            email: 1
          })
          .sort({ name: 1 })
          .skip(options.offset)
          .limit(options.limit)
          .toArray()
      ]);

      // 4. Shape to match available-users convention and wrap in envelope
      const items = available.map((u: any) => ({
        id: u._id,
        name: u[GroupMembers_Keys.UserName] ?? u.name,
        email: u.email
      }));
      return createResponse(HttpStatus.OK, messages.S8, {
        totalCount,
        offset: options.offset,
        limit: items.length,
        items
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableMembersForGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Delete Group
  async deleteGroup(groupId: Types.ObjectId, creatorId: Types.ObjectId): Promise<AppResponse> {
    try {
      const deletedGroup = await this._groupsSchema.findOneAndDelete({
        [Groups_Keys.id]: groupId,
        [Groups_Keys.CreatedBy]: creatorId
      });

      if (!deletedGroup) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W13);
      }

      await Promise.all([
        this._groupMembersSchema.deleteMany({ [GroupMembers_Keys.GroupId]: groupId }),
        this._messagesSchema.deleteMany({
          [Messages_Keys.ChatId]: this._groupChatId(groupId.toString())
        })
      ]);

      return createResponse(HttpStatus.OK, messages.S12, { groupId: groupId.toString() });
    } catch (error) {
      this._loggerSvc.error(__filename, this.deleteGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Delete Group

  //#region Transfer Group Ownership
  async transferGroupOwnership(
    groupId: Types.ObjectId,
    newOwnerId: Types.ObjectId,
    newOwnerName: string
  ): Promise<AppResponse> {
    try {
      const updated = await this._groupsSchema.findOneAndUpdate(
        { [Groups_Keys.id]: groupId },
        {
          $set: {
            [Groups_Keys.CreatedBy]: newOwnerId,
            [Groups_Keys.CreatedByName]: newOwnerName
          }
        },
        { new: true }
      );

      if (!updated) return createResponse(HttpStatus.NOT_FOUND, messages.W5, null);
      return createResponse(HttpStatus.OK, messages.S13, updated);
    } catch (error) {
      this._loggerSvc.error(__filename, this.transferGroupOwnership.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Transfer Group Ownership
}
