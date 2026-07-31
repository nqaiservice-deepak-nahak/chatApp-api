import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({summary:"Create a new group (creator auto-joins)."})
  async createGroup(@Body() body: CreateGroupDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.createGroup(body, claims);
  }
  //#endregion Create Group

  //#region Get My Groups
  @Post('my')
  @ApiOperation({summary:"List groups you've already joined."})
  async getMyGroups(@Body() body: PaginatedSearchDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getMyGroups(body, claims);
  }
  //#endregion Get My Groups

  //#region Get Available Groups
  @Post('available')
  @ApiOperation({summary:"List available public groups you haven't joined yet."})
  async getAvailableGroups(@Body() body: PaginatedSearchDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getAvailableGroups(body, claims);
  }
  //#endregion Get Available Groups

  //#region Search Public Groups
  @Post('search')
  @ApiOperation({summary:"Search public groups by name."})
  async searchPublicGroups(
    @Body() body: SearchPublicGroupsDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.searchPublicGroups(body, claims);
  }
  //#endregion Search Public Groups

  //#region Get Group Details
  @Get(':groupId')
  @ApiOperation({summary:"Get details of a specific group."})
  async getGroupDetails(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.getGroupDetails(groupId, claims);
  }
  //#endregion Get Group Details

  //#region Join Group
  @Post(':groupId/join')
  @ApiOperation({summary:"Join a group."})
  async joinGroup(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.joinGroup(groupId, claims);
  }
  //#endregion Join Group

  //#region Get Available Members For Group (users NOT yet in this group)
  @Post(':groupId/available-members')
  @ApiOperation({summary:"List users not yet in this group (for adding)."})
  async getAvailableMembersForGroup(
    @Param('groupId') groupId: string,
    @Body() body: PaginatedSearchDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.getAvailableMembersForGroup(groupId, body, claims);
  }
  //#endregion Get Available Members For Group

  //#region Add Members to Existing Group
  @Post(':groupId/members')
  @ApiOperation({summary:"Add one or more members to a group (creator only)."})
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
  @ApiOperation({summary:"Mark a group's messages as read."})
  async markGroupAsRead(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.markGroupAsRead(groupId, claims);
  }
  //#endregion Mark Group As Read

  //#region Delete Group
  @Delete(':groupId')
  @ApiOperation({summary:"Delete a group (creator only)."})
  async deleteGroup(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._groupsService.deleteGroup(groupId, claims);
  }
  //#endregion Delete Group

  //#region Transfer Group Ownership
  @Post(':groupId/transfer-ownership')
  @ApiOperation({summary:"Transfer group ownership to another member (creator only)."})
  async transferGroupOwnership(
    @Param('groupId') groupId: string,
    @Body() body: TransferGroupOwnershipDto,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._groupsService.transferGroupOwnership(groupId, body, claims);
  }
  //#endregion Transfer Group Ownership
}
