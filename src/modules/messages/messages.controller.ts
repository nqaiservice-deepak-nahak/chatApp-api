import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { MessagesAbstractSvc } from './messages.abstract';
import { GetChatHistoryDto, GetPrivateChatHistoryDto, SendMessageDto } from './dto/messages.dto';

@Controller()
@ApiTags('Messages')
@Authorize()
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly _messagesService: MessagesAbstractSvc) { }

  //#region Combined My Chats
  @Get('chats')
  async getMyChats(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getMyChats(claims);
  }
  //#endregion Combined My Chats

  //#region Get Chat History
  @Post('history')
  async getChatHistory(@Body() dto: GetChatHistoryDto,@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getChatHistory(dto, claims);
  }
  //#endregion Get Chat History


  //#region get Private Chat History
  @Post('messages/private-history')
  async getPrivateChatHistory(@Body() dto: GetPrivateChatHistoryDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getPrivateChatHistory(dto, claims);
  }
  //#endregion

  //#region send Private Message
  @Post('messages/private/:userId')
  async sendPrivateMessage(@Param('userId') userId: string, @Body() body: SendMessageDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.sendPrivateMessage(userId, body.message, claims);
  }
  //#endregion

  //#region Get My Direct Conversations
  @Get('messages/direct')
  async getMyDirectConversations(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._messagesService.getMyDirectConversations(claims);
  }
  //#endregion

  //#region Mark Direct Chat As Read
  @Post('messages/direct/:otherUserId/mark-as-read')
  async markDirectChatAsRead(
    @Param('otherUserId') otherUserId: string,
    @CurrentUser() claims: AtPayload
  ): Promise<AppResponse> {
    return await this._messagesService.markDirectChatAsRead(otherUserId, claims);
  }
  //#endregion
}
