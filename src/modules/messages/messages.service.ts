import AppLogger from '@app/core/loggers/app-logger';
import { AbstractDirectChatMetaDao } from '@app/database/mongodb/abstract/direct-chat-meta.abstract';
import { AbstractGroupsDao } from '@app/database/mongodb/abstract/groups.abstract';
import { AbstractMessagesDao } from '@app/database/mongodb/abstract/messages.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MessagesAbstractSvc } from './messages.abstract';
import { GetChatHistoryDto } from './dto/messages.dto';

@Injectable()
export class MessagesService implements MessagesAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(AbstractMessagesDao)
    private readonly _messagesDao: AbstractMessagesDao,
    @Inject(AbstractGroupsDao)
    private readonly _groupsDao: AbstractGroupsDao,
    @Inject(AbstractDirectChatMetaDao)
    private readonly _directChatMetaDao: AbstractDirectChatMetaDao
  ) { }

  //#region Get Chat History
  /**
   * Enforces the core business rule: a member only sees messages sent on
   * or after the moment they joined this specific group.
   */
  async getChatHistory(dto: GetChatHistoryDto,claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(dto.groupId)) {
        return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
      }

      const membershipRes = await this._groupsDao.isMember(
        new Types.ObjectId(dto.groupId),
        new Types.ObjectId(claims.userId),
      );

      if (!membershipRes.data) {
        return createResponse(HttpStatus.FORBIDDEN, messages.W9);
      }

      return await this._messagesDao.getChatHistory(
        new Types.ObjectId(dto.groupId),
        membershipRes.data.joinedAt,
        dto.offset,
        dto.limit,
      );
    } catch (error) {
      this._loggerSvc.error(
        __filename,
        this.getChatHistory.name,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.stack,
      );

      return createResponse(
        HttpStatus.INTERNAL_SERVER_ERROR,
        messages.E2,
      );
    }
  }
  //#endregion Get Chat History

  //#region Send Message
  async sendMessage(groupId: string, text: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      return await this._messagesDao.createMessage({
        groupId: new Types.ObjectId(groupId),
        senderId: new Types.ObjectId(claims.userId),
        senderName: claims.name,
        message: text.trim(),
        messageType: 'group',
        createdOn: undefined as any
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.sendMessage.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Send Message


  //#region  getPrivateChatHistory
  async getPrivateChatHistory(otherUserId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(otherUserId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      return await this._messagesDao.getPrivateChatHistory(
        new Types.ObjectId(claims.userId),
        new Types.ObjectId(otherUserId)
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.getPrivateChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region sendPrivateMessage
  async sendPrivateMessage(receiverId: string, text: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(receiverId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      if (receiverId === claims.userId) {
        return createResponse(HttpStatus.BAD_REQUEST, 'You cannot send a message to yourself.');
      }

      const sendRes = await this._messagesDao.createMessage({
        receiverId: new Types.ObjectId(receiverId),
        senderId: new Types.ObjectId(claims.userId),
        senderName: claims.name,
        message: text.trim(),
        messageType: 'private',
        createdOn: undefined as any
      } as any);

      if (sendRes.code === HttpStatus.CREATED) {
        try {
          const preview = text.trim().slice(0, 100);
          await this._directChatMetaDao.updateLastMessageCache(
            new Types.ObjectId(claims.userId),
            new Types.ObjectId(receiverId),
            preview
          );
        } catch (cacheErr: unknown) {
          const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
          this._loggerSvc.error(__filename, 'sendPrivateMessage cacheUpdate', HttpStatus.INTERNAL_SERVER_ERROR, msg);
        }
      }

      return sendRes;
    } catch (error) {
      this._loggerSvc.error(__filename, this.sendPrivateMessage.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get My Direct Conversations
  async getMyDirectConversations(claims: AtPayload): Promise<AppResponse> {
    try {
      return await this._directChatMetaDao.getMyDirectConversations(
        new Types.ObjectId(claims.userId)
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyDirectConversations.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Mark Direct Chat As Read
  async markDirectChatAsRead(otherUserId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(otherUserId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);
      if (otherUserId === claims.userId) {
        return createResponse(HttpStatus.BAD_REQUEST, 'You cannot mark a chat with yourself as read.');
      }
      return await this._directChatMetaDao.markDirectChatAsRead(
        new Types.ObjectId(claims.userId),
        new Types.ObjectId(otherUserId)
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.markDirectChatAsRead.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
