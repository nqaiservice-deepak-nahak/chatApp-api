import AppLogger from '@app/core/loggers/app-logger';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  DirectChatMeta_Keys,
  IDirectChatMeta,
  Messages_Keys,
  Users_Keys
} from '../../schemas';
import { AbstractDirectChatMetaDao } from '../abstract/direct-chat-meta.abstract';
import { AbstractMessagesDao } from '../abstract/messages.abstract';
import { Collections } from '../connection/collections.mongo';
import { MongoConstants } from '../connection/constants.mongo';
import { currentDate } from '@app/core/utils/timestamp-util';

@Injectable()
export class DirectChatMetaDao implements AbstractDirectChatMetaDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(MongoConstants.DIRECT_CHAT_META_SCHEMA)
    private readonly _metaSchema: Model<IDirectChatMeta>,
    @Inject(AbstractMessagesDao)
    private readonly _messagesDao: AbstractMessagesDao
  ) {}

  //#region Mark Direct Chat As Read
  async markDirectChatAsRead(userId: Types.ObjectId, otherUserId: Types.ObjectId): Promise<AppResponse> {
    try {
      const updated = await this._metaSchema.findOneAndUpdate(
        {
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.OtherUserId]: otherUserId
        },
        { $set: { [DirectChatMeta_Keys.LastReadAt]: currentDate() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return createResponse(HttpStatus.OK, messages.S3, updated);
    } catch (error) {
      this._loggerSvc.error(
        __filename,
        this.markDirectChatAsRead.name,
        HttpStatus.INTERNAL_SERVER_ERROR,
        (error as Error).stack
      );
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Update Last Message Cache
  async updateLastMessageCache(
    userId: Types.ObjectId,
    otherUserId: Types.ObjectId,
    preview: string
  ): Promise<AppResponse> {
    try {
      const now = currentDate();
      const pairA = this._metaSchema.findOneAndUpdate(
        {
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.OtherUserId]: otherUserId
        },
        {
          $set: {
            [DirectChatMeta_Keys.LastMessagePreview]: preview,
            [DirectChatMeta_Keys.LastMessageAt]: now
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      const pairB = this._metaSchema.findOneAndUpdate(
        {
          [DirectChatMeta_Keys.UserId]: otherUserId,
          [DirectChatMeta_Keys.OtherUserId]: userId
        },
        {
          $set: {
            [DirectChatMeta_Keys.LastMessagePreview]: preview,
            [DirectChatMeta_Keys.LastMessageAt]: now
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      await Promise.all([pairA, pairB]);
      return createResponse(HttpStatus.OK, messages.S3, null);
    } catch (error) {
      this._loggerSvc.error(
        __filename,
        this.updateLastMessageCache.name,
        HttpStatus.INTERNAL_SERVER_ERROR,
        (error as Error).stack
      );
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get My Direct Conversations (enriched with unread)
  async getMyDirectConversations(userId: Types.ObjectId): Promise<AppResponse> {
    try {
      // 1. Find all meta rows for this user, sorted by most recent activity
      const metaRows = await this._metaSchema
        .find({ [DirectChatMeta_Keys.UserId]: userId })
        .sort({ [DirectChatMeta_Keys.LastMessageAt]: -1 })
        .exec();

      // 2. Collect all other user IDs for a single batch user lookup
      const otherUserIds = metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId]);

      // 3. Batch lookup of other users (name, email) — one query instead of N
      const usersModel = this._metaSchema.db.collection(Collections.Users);
      const otherUsersDocs = await usersModel
        .find({ _id: { $in: otherUserIds } })
        .project({ [Users_Keys.Name]: 1, [Users_Keys.Email]: 1 })
        .toArray();
      const otherUsersMap = new Map<string, { name: string; email: string }>();
      for (const u of otherUsersDocs) {
        otherUsersMap.set(u._id.toString(), {
          name: u[Users_Keys.Name],
          email: u[Users_Keys.Email]
        });
      }

      // 4. For each conversation, compute unreadCount and unreadPreview in parallel
      const enriched = await Promise.all(
        metaRows.map(async (row: any) => {
          const otherUserId = row[DirectChatMeta_Keys.OtherUserId];
          const otherUserIdStr = otherUserId.toString();
          const otherUser = otherUsersMap.get(otherUserIdStr) || { name: 'Unknown', email: '' };
          const since = row[DirectChatMeta_Keys.LastReadAt];

          // Count + preview queries — use messagesDao methods (safe, typed, proven)
          const [countRes, previewRes] = await Promise.all([
            this._messagesDao.getUnreadCountForPrivateChat(userId, otherUserId, since),
            this._messagesDao.getLastUnreadMessagesForPrivateChat(userId, otherUserId, since, 3)
          ]);

          return {
            userId: userId.toString(),
            otherUserId: otherUserIdStr,
            otherUserName: otherUser.name,
            otherUserEmail: otherUser.email,
            lastReadAt: row[DirectChatMeta_Keys.LastReadAt] || null,
            lastMessagePreview: row[DirectChatMeta_Keys.LastMessagePreview] || null,
            lastMessageAt: row[DirectChatMeta_Keys.LastMessageAt] || null,
            unreadCount: countRes.data ?? 0,
            unreadPreview: previewRes.data ?? []
          };
        })
      );

      // 5. Also include users we have chatted with via messages but have no meta row yet
      //    (handles historical data before this feature was added)
      // Find all unique (sender, receiver) pairs from private messages for this user
      const messagesCollection = this._metaSchema.db.collection(Collections.Messages);
      const sentPartners = await messagesCollection
        .aggregate([
          {
            $match: {
              [Messages_Keys.MessageType]: 'private',
              [Messages_Keys.SenderId]: userId
            }
          },
          { $group: { _id: `$${Messages_Keys.ReceiverId}` } }
        ])
        .toArray();
      const receivedPartners = await messagesCollection
        .aggregate([
          {
            $match: {
              [Messages_Keys.MessageType]: 'private',
              [Messages_Keys.ReceiverId]: userId
            }
          },
          { $group: { _id: `$${Messages_Keys.SenderId}` } }
        ])
        .toArray();

      const existingPartnerIds = new Set(
        metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId].toString())
      );
      const allPartnerIds = new Set<string>();
      for (const p of [...sentPartners, ...receivedPartners]) {
        const idStr = p._id?.toString();
        if (idStr && !existingPartnerIds.has(idStr)) {
          allPartnerIds.add(idStr);
        }
      }

      // For each newly-discovered partner without meta, create a virtual entry
      if (allPartnerIds.size > 0) {
        const objectIds = Array.from(allPartnerIds).map(
          (id) => new Types.ObjectId(id)
        );
        const missingUsersDocs = await usersModel
          .find({ _id: { $in: objectIds } })
          .project({ [Users_Keys.Name]: 1, [Users_Keys.Email]: 1 })
          .toArray();
        const missingUsersMap = new Map<string, { name: string; email: string }>();
        for (const u of missingUsersDocs) {
          missingUsersMap.set(u._id.toString(), {
            name: u[Users_Keys.Name],
            email: u[Users_Keys.Email]
          });
        }

        // Find last message per missing pair to fill lastMessagePreview/At
        for (const otherIdStr of allPartnerIds) {
          const otherIdObj = objectIds.find(
            (o) => o.toString() === otherIdStr
          )!;
          const userInfo = missingUsersMap.get(otherIdStr) || {
            name: 'Unknown',
            email: ''
          };

          // Last message preview — get latest message between pair
          const lastMsgList = await messagesCollection
            .find({
              [Messages_Keys.MessageType]: 'private',
              $or: [
                {
                  [Messages_Keys.SenderId]: userId,
                  [Messages_Keys.ReceiverId]: otherIdObj
                },
                {
                  [Messages_Keys.SenderId]: otherIdObj,
                  [Messages_Keys.ReceiverId]: userId
                }
              ]
            })
            .sort({ [Messages_Keys.CreatedOn]: -1 })
            .limit(1)
            .toArray();
          const lastMsg = lastMsgList[0];
          // Use epoch "0" as since for missing rows — counts ALL messages ever sent
          const sinceEpoch = '1970-01-01T00:00:00.000Z';

          const [countRes, previewRes] = await Promise.all([
            this._messagesDao.getUnreadCountForPrivateChat(
              userId,
              otherIdObj,
              sinceEpoch
            ),
            this._messagesDao.getLastUnreadMessagesForPrivateChat(
              userId,
              otherIdObj,
              sinceEpoch,
              3
            )
          ]);

          enriched.push({
            userId: userId.toString(),
            otherUserId: otherIdStr,
            otherUserName: userInfo.name,
            otherUserEmail: userInfo.email,
            lastReadAt: null, // never opened → no read mark yet
            lastMessagePreview: lastMsg
              ? String(lastMsg[Messages_Keys.Message] || '').slice(0, 100)
              : null,
            lastMessageAt: lastMsg ? lastMsg[Messages_Keys.CreatedOn] : null,
            unreadCount: countRes.data ?? 0,
            unreadPreview: previewRes.data ?? []
          });
        }
      }

      // 6. Final sort by lastMessageAt (newest first), nulls last
      enriched.sort((a: any, b: any) => {
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      });

      return createResponse(HttpStatus.OK, messages.S8, enriched);
    } catch (error) {
      this._loggerSvc.error(
        __filename,
        this.getMyDirectConversations.name,
        HttpStatus.INTERNAL_SERVER_ERROR,
        (error as Error).stack
      );
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region Get Existing Partner IDs (for filtering available users)
  async getExistingPartnerIds(userId: Types.ObjectId): Promise<AppResponse> {
    try {
      // 1. Partners already tracked in DirectChatMeta
      const metaRows = await this._metaSchema
        .find({ [DirectChatMeta_Keys.UserId]: userId })
        .select(`${DirectChatMeta_Keys.OtherUserId}`)
        .exec();
      const ids = new Set<string>(
        metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId].toString())
      );

      // 2. Also scan Messages for partners before DirectChatMeta existed (historical data)
      const messagesCollection = this._metaSchema.db.collection(Collections.Messages);
      const sentPartners = await messagesCollection
        .aggregate([
          { $match: { [Messages_Keys.MessageType]: 'private', [Messages_Keys.SenderId]: userId } },
          { $group: { _id: `${Messages_Keys.ReceiverId}` } }
        ])
        .toArray();
      const receivedPartners = await messagesCollection
        .aggregate([
          { $match: { [Messages_Keys.MessageType]: 'private', [Messages_Keys.ReceiverId]: userId } },
          { $group: { _id: `${Messages_Keys.SenderId}` } }
        ])
        .toArray();

      for (const p of [...sentPartners, ...receivedPartners]) {
        const idStr = p._id?.toString();
        if (idStr) ids.add(idStr);
      }

      return createResponse(HttpStatus.OK, messages.S3, Array.from(ids));
    } catch (error) {
      this._loggerSvc.error(
        __filename,
        this.getExistingPartnerIds.name,
        HttpStatus.INTERNAL_SERVER_ERROR,
        (error as Error).stack
      );
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
