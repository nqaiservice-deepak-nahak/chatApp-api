import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { MessagesAbstractSvc } from './messages.abstract';

@Controller()
@ApiTags('Messages')
@Authorize()
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly _messagesService: MessagesAbstractSvc) { }

  //#region Get Chat History
  @Get('groups/:groupId/messages')
  async getChatHistory(@Param('groupId') groupId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getChatHistory(groupId, claims);
  }
  //#endregion Get Chat History


  //#region get Private Chat History
  @Get('messages/private/:userId')
  async getPrivateChatHistory(@Param('userId') userId: string, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getPrivateChatHistory(userId, claims);
  }
  //#endregion

  //#region send Private Message
  @Post('messages/private/:userId')
  async sendPrivateMessage(@Param('userId') userId: string, @Body() body: { message: string }, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.sendPrivateMessage(userId, body.message, claims);
  }
  //#endregion
}
