import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { AddGroupMembersDto, CreateGroupDto, PaginatedSearchDto, SearchPublicGroupsDto, TransferGroupOwnershipDto } from './dto/groups.dto';
import { GroupsAbstractSvc } from './groups.abstract';

@Controller('groups')
@ApiTags('Groups')
@Authorize()
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly _groupsService: GroupsAbstractSvc) { }

  //#region Create Group
  @Post()
  async createGroup(@Body() body: CreateGroupDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.createGroup(body, claims);
  }
  //#endregion Create Group

  //#region Get My Groups
  @Post('my')
  async getMyGroups(@Body() body: PaginatedSearchDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getMyGroups(body, claims);
  }
  //#endregion Get My Groups

  //#region Get Available Groups
  @Post('available')
  async getAvailableGroups(@Body() body: PaginatedSearchDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getAvailableGroups(body, claims);
  }
  //#endregion Get Available Groups

  //#region Search Public Groups
  @Post('search')
  async searchPublicGroups(
    @Body() body: SearchPublicGroupsDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.searchPublicGroups(body, claims);
  }
  //#endregion Search Public Groups

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

  //#region Get Available Members For Group (users NOT yet in this group)
  @Get(':groupId/available-members')
  async getAvailableMembersForGroup(
    @Param('groupId') groupId: string,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.getAvailableMembersForGroup(groupId, claims);
  }
  //#endregion Get Available Members For Group

  //#region Add Members to Existing Group
  @Post(':groupId/members')
  async addGroupMembers(
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupMembersDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.addGroupMembers(groupId, dto, claims);
  }
  //#endregion Add Members to Existing Group

  //#region Mark Group As Read
  @Post(':groupId/mark-as-read')
  async markGroupAsRead(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.markGroupAsRead(groupId, claims);
  }
  //#endregion Mark Group As Read

  //#region Delete Group
  @Delete(':groupId')
  async deleteGroup(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.deleteGroup(groupId, claims);
  }
  //#endregion Delete Group

  //#region Transfer Group Ownership
  @Post(':groupId/transfer-ownership')
  async transferGroupOwnership(
    @Param('groupId') groupId: string,
    @Body() body: TransferGroupOwnershipDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.transferGroupOwnership(groupId, body, claims);
  }
  //#endregion Transfer Group Ownership
}
