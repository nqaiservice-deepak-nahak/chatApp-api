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
  async getChatHistory(groupId: Types.ObjectId,joinedAt: string,offset: number,limit: number): Promise<AppResponse> {
    try {
      // Fetch limit+1 so we can detect if another page exists without a separate count() query.
      const fetchLimit = Math.min(limit + 1, 101);
      const raw = await this._messagesSchema
        .find({
          [Messages_Keys.GroupId]: groupId,
          [Messages_Keys.CreatedOn]: {
            $gte: joinedAt,
          },
        })
        .sort({
          [Messages_Keys.CreatedOn]: -1,
        })
        .skip(offset)
        .limit(fetchLimit);

      const hasMore = raw.length > limit;
      const sliced = hasMore ? raw.slice(0, limit) : raw;
      // Reverse because internal DESC sort → chronological output (oldest first).
      const items = sliced.reverse();
      const nextOffset = hasMore ? offset + limit : null;

      return createResponse(HttpStatus.OK,messages.S10,{ items, hasMore, nextOffset });
    } catch (error) {
      this._loggerSvc.error(__filename,this.getChatHistory.name,HttpStatus.INTERNAL_SERVER_ERROR,(error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR,messages.E2);
    }
  }
  //#endregion Get Chat History

  //#region get Private Chat History
  /** Pagination: Returns { items, hasMore, nextOffset }; items in chronological order. */
  async getPrivateChatHistory(userId1: Types.ObjectId, userId2: Types.ObjectId, offset: number, limit: number): Promise<AppResponse> {
    try {
      const fetchLimit = Math.min(limit + 1, 101);
      const raw = await this._messagesSchema
        .find({
          [Messages_Keys.MessageType]: 'private',
          $or: [
            { [Messages_Keys.SenderId]: userId1, [Messages_Keys.ReceiverId]: userId2 },
            { [Messages_Keys.SenderId]: userId2, [Messages_Keys.ReceiverId]: userId1 }
          ]
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

    //#region Get Unread Count For Group
  /** Excludes messages sent by `viewerId` so the caller never sees their own msgs as unread. */
  async getUnreadCountForGroup(groupId: Types.ObjectId, sinceTimestamp: string, viewerId?: Types.ObjectId): Promise<AppResponse> {
    try {
      const filter: Record<string, any> = {
        [Messages_Keys.GroupId]: groupId,
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
  async getLastUnreadMessagesForGroup(groupId: Types.ObjectId, sinceTimestamp: string, limit: number, viewerId?: Types.ObjectId): Promise<AppResponse> {
    try {
      const filter: Record<string, any> = {
        [Messages_Keys.GroupId]: groupId,
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
    viewerId: Types.ObjectId,
    otherId: Types.ObjectId,
    sinceTimestamp: string
  ): Promise<AppResponse> {
    try {
      // Count only messages SENT BY the other user (viewer's own sent messages don't count as unread)
      const count = await this._messagesSchema.countDocuments({
        [Messages_Keys.MessageType]: 'private',
        [Messages_Keys.SenderId]: otherId,
        [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp },
        $or: [
          { [Messages_Keys.ReceiverId]: viewerId },
          { [Messages_Keys.SenderId]: viewerId }
        ]
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
    viewerId: Types.ObjectId,
    otherId: Types.ObjectId,
    sinceTimestamp: string,
    limit: number
  ): Promise<AppResponse> {
    try {
      const preview = await this._messagesSchema
        .find({
          [Messages_Keys.MessageType]: 'private',
          [Messages_Keys.SenderId]: otherId,
          [Messages_Keys.CreatedOn]: { $gt: sinceTimestamp },
          $or: [
            { [Messages_Keys.ReceiverId]: viewerId },
            { [Messages_Keys.SenderId]: viewerId }
          ]
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
