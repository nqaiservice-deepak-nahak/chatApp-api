import AppLogger from '@app/core/loggers/app-logger';
import { AbstractGroupsDao } from '@app/database/mongodb/abstract/groups.abstract';
import { AbstractAuthDao } from '@app/database/mongodb/abstract/auth.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AddGroupMembersDto, CreateGroupDto, PaginatedSearchDto, SearchPublicGroupsDto, TransferGroupOwnershipDto } from './dto/groups.dto';
import { GroupsAbstractSvc } from './groups.abstract';
import { GroupType } from '@app/database/schemas';
import { GroupNotificationService } from '@app/modules/socket/group-notification.service';

@Injectable()
export class GroupsService implements GroupsAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _groupsDao: AbstractGroupsDao,
    private readonly _authDao: AbstractAuthDao,
    private readonly _groupNotificationService: GroupNotificationService
  ) { }

  async getMemberUserIds(groupId: string): Promise<AppResponse> {
    if (!Types.ObjectId.isValid(groupId)) {
      return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
    }
    return this._groupsDao.getMemberUserIds(new Types.ObjectId(groupId));
  }

  //#region Create Group
  async createGroup(body: CreateGroupDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const createRes = await this._groupsDao.createGroup({
        name: body.name.trim(),
        description: body.description?.trim() || '',
        type: (body.type as any) || 'public',
        createdBy: new Types.ObjectId(claims.userId),
        createdByName: claims.name,
        createdOn: undefined as any
      });
      if (createRes.code !== HttpStatus.CREATED) return createRes;

      /*creator automatically becomes a member of the group*/
      const group: any = createRes.data;
      await this._groupsDao.addMember(group._id, new Types.ObjectId(claims.userId), claims.name);

      // Add any additional members provided in the DTO
      const summary: { id: string; ok: boolean; reason?: string }[] = [];
      if (body.memberIds && Array.isArray(body.memberIds) && body.memberIds.length) {
        // dedupe and exclude creator
        const uniqueIds = Array.from(new Set(body.memberIds)).filter((id) => id !== claims.userId);
        const addPromises = uniqueIds.map(async (id) => {
          if (!Types.ObjectId.isValid(id)) return { id, ok: false, reason: 'invalid id' };
          const userRes = await this._authDao.findUserById(id);
          if (userRes.code !== HttpStatus.OK) return { id, ok: false, reason: 'user not found' };
          const name = userRes.data.name;
          const res = await this._groupsDao.addMember(group._id, new Types.ObjectId(id), name);
          if (res.code === HttpStatus.CREATED) return { id, ok: true };
          // conflict (already member) or other error
          return { id, ok: false, reason: res.message || 'failed' };
        });

        const results = await Promise.all(addPromises);
        summary.push(...results);
      }

      return createResponse(HttpStatus.CREATED, messages.S6, { group, memberAddSummary: summary });
    } catch (error) {
      this._loggerSvc.error(__filename, this.createGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Create Group

  //#region Get My Groups
  async getMyGroups(body: PaginatedSearchDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const offset = body.offset ?? 0;
      const limit = body.limit ?? 50;
      const search = body.searchData?.trim() || undefined;
      return await this._groupsDao.getMyGroups(new Types.ObjectId(claims.userId), { search, offset, limit });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get My Groups

  //#region Get Available Groups
  async getAvailableGroups(body: PaginatedSearchDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const offset = body.offset ?? 0;
      const limit = body.limit ?? 50;
      const search = body.searchData?.trim() || undefined;
      return await this._groupsDao.getAvailableGroups(new Types.ObjectId(claims.userId), { search, offset, limit });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Available Groups

  //#region Search Public Groups
  async searchPublicGroups(body: SearchPublicGroupsDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const searchTerm = body.searchData.trim();
      if (!searchTerm) {
        return createResponse(HttpStatus.OK, messages.S8, []);
      }
      return await this._groupsDao.searchPublicGroups(new Types.ObjectId(claims.userId), searchTerm);
    } catch (error) {
      this._loggerSvc.error(__filename, this.searchPublicGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Search Public Groups

  //#region Get Group Details
  async getGroupDetails(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));

      if (groupRes.data.type === GroupType.Private && !membershipRes.data) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W18);
      }

      const memberCountRes = await this._groupsDao.getMemberCount(new Types.ObjectId(groupId));

      return createResponse(HttpStatus.OK, messages.S9, {
        ...groupRes.data.toObject(),
        totalMembers: memberCountRes.data,
        isMember: Boolean(membershipRes.data),
        joinedAt: membershipRes.data?.joinedAt || null
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getGroupDetails.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Group Details

  //#region Join Group
  async joinGroup(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      const existingMembership = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));
      if (existingMembership.data) return createResponse(HttpStatus.CONFLICT, messages.W8);

      if (groupRes.data.type === GroupType.Private) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W16);
      }


      return await this._groupsDao.addMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId), claims.name);
    } catch (error) {
      this._loggerSvc.error(__filename, this.joinGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Join Group

  //#region Leave Group
  async leaveGroup(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) {
        return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
      }

      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      if (groupRes.data.createdBy.toString() === claims.userId) {
        return createResponse(
          HttpStatus.BAD_REQUEST,
          'The group owner must transfer ownership or delete the group before leaving.'
        );
      }

      const membershipRes = await this._groupsDao.isMember(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      return await this._groupsDao.removeMember(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.leaveGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Leave Group

  //#region Verify Membership (used by the socket gateway)
  async verifyMembership(groupId: string, userId: string): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(userId)) {
        return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
      }
      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(userId));
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);
      return createResponse(HttpStatus.OK, messages.S3, membershipRes.data);
    } catch (error) {
      this._loggerSvc.error(__filename, this.verifyMembership.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Verify Membership

  async getGroupMembers(groupId: string): Promise<AppResponse> {
    if (!Types.ObjectId.isValid(groupId)) {
      return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
    }
    return this._groupsDao.getGroupMembers(new Types.ObjectId(groupId));
  }

  //#region Add Members to Existing Group
  async addGroupMembers(groupId: string, dto: AddGroupMembersDto, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      // 1. Validate the group exists
      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      // 2. Validate the caller IS THE CREATOR of this group (only creator can add members)
      if (groupRes.data.createdBy.toString() !== claims.userId) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W13);
      }

      // 3. Dedupe + exclude the caller from being added to their own group
      const uniqueIds = Array.from(new Set(dto.memberIds));

      if (uniqueIds.length === 0) {
        return createResponse(HttpStatus.OK, messages.S7, { added: 0, results: [] });
      }

      // 4. Try to add each member (same pattern as createGroup flow for consistency)
      const groupObjectId = new Types.ObjectId(groupId);
      const addPromises = uniqueIds.map(async (id) => {
        if (!Types.ObjectId.isValid(id)) return { id, ok: false, reason: 'invalid id' };

        if (id === claims.userId) {
          return {
            id,ok: false,reason: 'Group creator is already a member.'};
        }

        const userRes = await this._authDao.findUserById(id);
        if (userRes.code !== HttpStatus.OK) return { id, ok: false, reason: 'user not found' };

        const name = userRes.data.name;
        const res = await this._groupsDao.addMember(groupObjectId, new Types.ObjectId(id), name);
        if (res.code === HttpStatus.CREATED) return { id, ok: true };
        return { id, ok: false, reason: res.message || 'failed' };
      });

      const results = await Promise.all(addPromises);
      const addedCount = results.filter((r) => r.ok).length;

      return createResponse(
        addedCount > 0 ? HttpStatus.CREATED : HttpStatus.OK,
        addedCount > 0 ? messages.S7 : messages.S3,
        { added: addedCount, results }
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.addGroupMembers.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Add Members to Existing Group

  //#region Get Available Members For Group
  async getAvailableMembersForGroup(
    groupId: string,
    body: PaginatedSearchDto,
    claims: AtPayload
  ): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      const membershipRes = await this._groupsDao.isMember(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      const offset = body.offset ?? 0;
      const limit = body.limit ?? 50;
      const search = body.searchData?.trim() || undefined;

      return await this._groupsDao.getAvailableMembersForGroup(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId),
        { search, offset, limit }
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableMembersForGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Available Members For Group

  //#region Mark Group As Read
  async markGroupAsRead(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      const membershipRes = await this._groupsDao.isMember(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      return await this._groupsDao.markGroupAsRead(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.markGroupAsRead.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Mark Group As Read

  //#region Delete Group
  async deleteGroup(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) {
        return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
      }

      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      if (groupRes.data.createdBy.toString() !== claims.userId) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W13);
      }

      const deleteRes = await this._groupsDao.deleteGroup(
        new Types.ObjectId(groupId),
        new Types.ObjectId(claims.userId)
      );

      if (deleteRes.code === HttpStatus.OK) {
        this._groupNotificationService.notifyGroupDeleted(groupId);
      }

      return deleteRes;
    } catch (error) {
      this._loggerSvc.error(__filename, this.deleteGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Delete Group

  //#region Transfer Group Ownership
  async transferGroupOwnership(
    groupId: string,
    body: TransferGroupOwnershipDto,
    claims: AtPayload
  ): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      // Prevent transferring ownership to yourself
      if (body.newOwnerUserId === claims.userId) {
        return createResponse(HttpStatus.BAD_REQUEST, messages.W15);
      }

      // 1. Group must exist
      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK)
        return createResponse(HttpStatus.NOT_FOUND,messages.W19, null);
      
      // 2. Caller must be the current creator / owner
      if (groupRes.data.createdBy.toString() !== claims.userId) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W13);
      }

      const groupObjectId = new Types.ObjectId(groupId);
      const newOwnerObjectId = new Types.ObjectId(body.newOwnerUserId);

      // 3. New owner must be a member of the group first
      const targetMembership = await this._groupsDao.isMember(groupObjectId, newOwnerObjectId);
      if (!targetMembership.data) return createResponse(HttpStatus.BAD_REQUEST, messages.W14);

      // 4. Resolve new owner's name (to keep createdByName in sync)
      const userRes = await this._authDao.findUserById(body.newOwnerUserId);
      if (userRes.code !== HttpStatus.OK) return userRes;

      // 5. Apply ownership transfer
      return await this._groupsDao.transferGroupOwnership(
        groupObjectId,
        new Types.ObjectId(claims.userId),
        newOwnerObjectId,
        userRes.data.name
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.transferGroupOwnership.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Transfer Group Ownership
}
