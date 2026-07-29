import AppLogger from '@app/core/loggers/app-logger';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { IMessage, Messages_Keys } from '../../schemas';
import { AbstractMessagesDao } from '../abstract/messages.abstract';
import { MongoConstants } from '../connection/constants.mongo';

@Injectable()
export class MessagesDao implements AbstractMessagesDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(MongoConstants.MESSAGES_SCHEMA) private readonly _messagesSchema: Model<IMessage>
  ) { }

  //#region Create Message
  async createMessage(messageInfo: IMessage): Promise<AppResponse> {
    try {
      const message = new this._messagesSchema(messageInfo);
      await message.save();
      return createResponse(HttpStatus.CREATED, messages.S11, message);
    } catch (error) {
      this._loggerSvc.error(__filename, this.createMessage.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Create Message

  //#region Get Chat History
  /**
   * MOST IMPORTANT BUSINESS RULE: a member only ever sees messages created
   * on/after their own `joinedAt` timestamp for that group. Every caller
   * passes in the member's own joinedAt value from GroupMembers.
   */
  async getChatHistory(groupId: Types.ObjectId, joinedAt: string): Promise<AppResponse> {
    try {
      const history = await this._messagesSchema
        .find({
          [Messages_Keys.GroupId]: groupId,
          [Messages_Keys.CreatedOn]: { $gte: joinedAt }
        })
        .sort({ [Messages_Keys.CreatedOn]: 1 });

      return createResponse(HttpStatus.OK, messages.S10, history);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Chat History

  //#region get Private Chat History
  async getPrivateChatHistory(userId1: Types.ObjectId, userId2: Types.ObjectId): Promise<AppResponse> {
    try {
      const history = await this._messagesSchema
        .find({
          [Messages_Keys.MessageType]: 'private',
          $or: [
            { [Messages_Keys.SenderId]: userId1, [Messages_Keys.ReceiverId]: userId2 },
            { [Messages_Keys.SenderId]: userId2, [Messages_Keys.ReceiverId]: userId1 }
          ]
        })
        .sort({ [Messages_Keys.CreatedOn]: 1 });

      return createResponse(HttpStatus.OK, messages.S10, history);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getPrivateChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
