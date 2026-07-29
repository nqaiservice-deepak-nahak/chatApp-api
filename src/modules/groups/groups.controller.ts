import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { CreateGroupDto } from './dto/groups.dto';
import { GroupsAbstractSvc } from './groups.abstract';

@Controller('groups')
@ApiTags('Groups')
@Authorize()
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly _groupsService: GroupsAbstractSvc) {}

  //#region Create Group
  @Post()
  async createGroup(@Body() body: CreateGroupDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.createGroup(body, claims);
  }
  //#endregion Create Group

  //#region Get My Groups
  @Get('my')
  async getMyGroups(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getMyGroups(claims);
  }
  //#endregion Get My Groups

  //#region Get Available Groups
  @Get('available')
  async getAvailableGroups(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getAvailableGroups(claims);
  }
  //#endregion Get Available Groups

  //#region Get Group Details
  @Get(':groupId')
  async getGroupDetails(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getGroupDetails(groupId, claims);
  }
  //#endregion Get Group Details

  //#region Join Group
  @Post(':groupId/join')
  async joinGroup(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.joinGroup(groupId, claims);
  }
  //#endregion Join Group
}
