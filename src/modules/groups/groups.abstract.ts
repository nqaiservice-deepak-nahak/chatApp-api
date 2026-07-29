import { AppResponse } from '../../shared/app-response.shared';
import { AtPayload } from '../../shared/model.shared';
import { CreateGroupDto } from './dto/groups.dto';

export abstract class GroupsAbstractSvc {
  abstract createGroup(body: CreateGroupDto, claims: AtPayload): Promise<AppResponse>;
  abstract getMyGroups(claims: AtPayload): Promise<AppResponse>;
  abstract getAvailableGroups(claims: AtPayload): Promise<AppResponse>;
  abstract getGroupDetails(groupId: string, claims: AtPayload): Promise<AppResponse>;
  abstract joinGroup(groupId: string, claims: AtPayload): Promise<AppResponse>;
  /** Internal helper used by the socket gateway to authorize room joins. */
  abstract verifyMembership(groupId: string, userId: string): Promise<AppResponse>;
  abstract markGroupAsRead(groupId: string, claims: AtPayload): Promise<AppResponse>;
}
