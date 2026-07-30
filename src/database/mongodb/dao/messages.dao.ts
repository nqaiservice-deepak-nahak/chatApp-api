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
   *
   * Pagination: Returns { items, hasMore, nextOffset } with items in chronological order.
   */
  async getChatHistory(chatId: string, joinedAt: string, offset: number, limit: number): Promise<AppResponse> {
    try {
      return await this.getChatHistoryByChatId(chatId, joinedAt, offset, limit);
    } catch (error) {
      this._loggerSvc.error(__filename,this.getChatHistory.name,HttpStatus.INTERNAL_SERVER_ERROR,(error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR,messages.E2);
    }
  }

  async getChatHistoryByChatId(chatId: string, joinedAt: string, offset: number, limit: number): Promise<AppResponse> {
    try {
      const fetchLimit = Math.min(limit + 1, 101);
      const query: Record<string, any> = {
        [Messages_Keys.ChatId]: chatId,
        [Messages_Keys.CreatedOn]: {
          $gte: joinedAt,
        },
      };

      const raw = await this._messagesSchema
        .find(query)
        .sort({
          [Messages_Keys.CreatedOn]: -1,
        })
        .skip(offset)
        .limit(fetchLimit);

      const hasMore = raw.length > limit;
      const sliced = hasMore ? raw.slice(0, limit) : raw;
      const items = sliced.reverse();
      const nextOffset = hasMore ? offset + limit : null;

      return createResponse(HttpStatus.OK, messages.S10, { items, hasMore, nextOffset });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getChatHistoryByChatId.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Chat History

  //#region get Private Chat History
  /** Pagination: Returns { items, hasMore, nextOffset }; items in chronological order. */
  async getPrivateChatHistory(chatId: string, offset: number, limit: number): Promise<AppResponse> {
    try {
      const fetchLimit = Math.min(limit + 1, 101);
      const raw = await this._messagesSchema
        .find({
          [Messages_Keys.ChatId]: chatId,
          [Messages_Keys.MessageType]: 'private',
        })
        .sort({ [Messages_Keys.CreatedOn]: -1 })   // NEWEST first internally
        .skip(offset)
        .limit(fetchLimit);

      const hasMore = raw.length > limit;
      const sliced = hasMore ? raw.slice(0, limit) : raw;
      const items = sliced.reverse();   // → chronological output
      const nextOffset = hasMore ? offset + limit : null;

      return createResponse(HttpStatus.OK, messages.S10, { items, hasMore, nextOffset });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getPrivateChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  async getPrivateChatHistoryByChatId(chatId: string, offset: number, limit: number): Promise<AppResponse> {
    try {
      return await this.getPrivateChatHistory(chatId, offset, limit);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getPrivateChatHistoryByChatId.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

    //#region Get Unread Count For Group
  /** Excludes messages sent by `viewerId` so the caller never sees their own msgs as unread. */
  async getUnreadCountForGroup(chatId: string, sinceTimestamp: string, viewerId?: Types.ObjectId): Promise<AppResponse> {
    try {
      const filter: Record<string, any> = {
        [Messages_Keys.ChatId]: chatId,
        [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp }
      };
      if (viewerId) {
        filter[Messages_Keys.SenderId] = { $ne: viewerId };
      }
      const count = await this._messagesSchema.countDocuments(filter);
      return createResponse(HttpStatus.OK, messages.S3, count);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getUnreadCountForGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get Last Unread Messages For Group
  /** Excludes messages sent by `viewerId` so the caller never sees their own msgs as unread. */
  async getLastUnreadMessagesForGroup(chatId: string, sinceTimestamp: string, limit: number, viewerId?: Types.ObjectId): Promise<AppResponse> {
    try {
      const filter: Record<string, any> = {
        [Messages_Keys.ChatId]: chatId,
        [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp }
      };
      if (viewerId) {
        filter[Messages_Keys.SenderId] = { $ne: viewerId };
      }
      const preview = await this._messagesSchema
        .find(filter)
        .sort({ [Messages_Keys.CreatedOn]: -1 })
        .limit(limit);

      // Preview should show in chronological order (oldest of the 3 first)
      return createResponse(HttpStatus.OK, messages.S3, preview.reverse());
    } catch (error) {
      this._loggerSvc.error(__filename, this.getLastUnreadMessagesForGroup.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get Unread Count For Private Chat
  async getUnreadCountForPrivateChat(
    chatId: string,
    viewerId: Types.ObjectId,
    sinceTimestamp: string
  ): Promise<AppResponse> {
    try {
      const count = await this._messagesSchema.countDocuments({
        [Messages_Keys.ChatId]: chatId,
        [Messages_Keys.MessageType]: 'private',
        [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp },
        [Messages_Keys.SenderId]: { $ne: viewerId }
      });
      return createResponse(HttpStatus.OK, messages.S3, count);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getUnreadCountForPrivateChat.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get Last Unread Messages For Private Chat
  async getLastUnreadMessagesForPrivateChat(
    chatId: string,
    viewerId: Types.ObjectId,
    sinceTimestamp: string,
    limit: number
  ): Promise<AppResponse> {
    try {
      const preview = await this._messagesSchema
        .find({
          [Messages_Keys.ChatId]: chatId,
          [Messages_Keys.MessageType]: 'private',
          [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp },
          [Messages_Keys.SenderId]: { $ne: viewerId }
        })
        .sort({ [Messages_Keys.CreatedOn]: -1 })
        .limit(limit);

      return createResponse(HttpStatus.OK, messages.S3, preview.reverse());
    } catch (error) {
      this._loggerSvc.error(__filename, this.getLastUnreadMessagesForPrivateChat.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
