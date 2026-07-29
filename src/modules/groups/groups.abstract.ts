import { AppResponse } from '../../shared/app-response.shared';
import { AtPayload } from '../../shared/model.shared';
import { AddGroupMembersDto, CreateGroupDto } from './dto/groups.dto';

export abstract class GroupsAbstractSvc {
  abstract createGroup(body: CreateGroupDto, claims: AtPayload): Promise<AppResponse>;
  abstract getMyGroups(claims: AtPayload): Promise<AppResponse>;
  abstract getAvailableGroups(claims: AtPayload): Promise<AppResponse>;
  abstract getGroupDetails(groupId: string, claims: AtPayload): Promise<AppResponse>;
  abstract joinGroup(groupId: string, claims: AtPayload): Promise<AppResponse>;
  /** Internal helper used by the socket gateway to authorize room joins. */
  abstract verifyMembership(groupId: string, userId: string): Promise<AppResponse>;
  /** Add one or more existing users to an already-created group; returns per-ID results. */
  abstract addGroupMembers(groupId: string, dto: AddGroupMembersDto, claims: AtPayload): Promise<AppResponse>;
  abstract markGroupAsRead(groupId: string, claims: AtPayload): Promise<AppResponse>;
  /** Return users NOT yet in the group (excludes caller) for the "Add Members" picker. */
  abstract getAvailableMembersForGroup(groupId: string, claims: AtPayload): Promise<AppResponse>;
}
