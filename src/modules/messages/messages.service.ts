import AppLogger from '@app/core/loggers/app-logger';
import { AbstractGroupsDao } from '@app/database/mongodb/abstract/groups.abstract';
import { AbstractMessagesDao } from '@app/database/mongodb/abstract/messages.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MessagesAbstractSvc } from './messages.abstract';

@Injectable()
export class MessagesService implements MessagesAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _messagesDao: AbstractMessagesDao,
    private readonly _groupsDao: AbstractGroupsDao
  ) { }

  //#region Get Chat History
  /**
   * Enforces the core business rule: a member only sees messages sent on
   * or after the moment they joined this specific group.
   */
  async getChatHistory(groupId: string, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      const joinedAt = membershipRes.data.joinedAt;
      return await this._messagesDao.getChatHistory(new Types.ObjectId(groupId), joinedAt);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
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

      return await this._messagesDao.createMessage({
        receiverId: new Types.ObjectId(receiverId),
        senderId: new Types.ObjectId(claims.userId),
        senderName: claims.name,
        message: text.trim(),
        messageType: 'private',
        createdOn: undefined as any
      } as any);
    } catch (error) {
      this._loggerSvc.error(__filename, this.sendPrivateMessage.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
