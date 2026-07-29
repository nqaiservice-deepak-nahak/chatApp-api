import AppLogger from '@app/core/loggers/app-logger';
import { AbstractGroupsDao } from '@app/database/mongodb/abstract/groups.abstract';
import { AbstractAuthDao } from '@app/database/mongodb/abstract/auth.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateGroupDto } from './dto/groups.dto';
import { GroupsAbstractSvc } from './groups.abstract';

@Injectable()
export class GroupsService implements GroupsAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _groupsDao: AbstractGroupsDao,
    private readonly _authDao: AbstractAuthDao
  ) {}

  //#region Create Group
  async createGroup(body: CreateGroupDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const createRes = await this._groupsDao.createGroup({
        name: body.name.trim(),
        description: body.description?.trim() || '',
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
  async getMyGroups(claims: AtPayload): Promise<AppResponse> {
    try {
      return await this._groupsDao.getMyGroups(new Types.ObjectId(claims.userId));
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get My Groups

  //#region Get Available Groups
  async getAvailableGroups(claims: AtPayload): Promise<AppResponse> {
    try {
      return await this._groupsDao.getAvailableGroups(new Types.ObjectId(claims.userId));
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableGroups.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Available Groups

  //#region Get Group Details
  async getGroupDetails(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      const groupRes = await this._groupsDao.findGroupById(groupId);
      if (groupRes.code !== HttpStatus.OK) return groupRes;

      const memberCountRes = await this._groupsDao.getMemberCount(new Types.ObjectId(groupId));
      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));

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

      return await this._groupsDao.addMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId), claims.name);
    } catch (error) {
      this._loggerSvc.error(__filename, this.joinGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Join Group

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
}
