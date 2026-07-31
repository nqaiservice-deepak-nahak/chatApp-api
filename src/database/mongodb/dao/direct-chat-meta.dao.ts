import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import AppLogger from '@app/core/loggers/app-logger';
import { decrypt, encrypt } from '@app/core/utils/encrypt.util';
import { currentDate } from '@app/core/utils/timestamp-util';
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

@Injectable()
export class DirectChatMetaDao implements AbstractDirectChatMetaDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _appConfigSvc: AppConfigService,
    @Inject(MongoConstants.DIRECT_CHAT_META_SCHEMA)
    private readonly _metaSchema: Model<IDirectChatMeta>,
    @Inject(AbstractMessagesDao)
    private readonly _messagesDao: AbstractMessagesDao
  ) {}

  private _privateChatId(userIdA: Types.ObjectId | string, userIdB: Types.ObjectId | string): string {
    return `direct:${[String(userIdA), String(userIdB)].sort().join(':')}`;
  }

  /** Safely decrypt a lastMessagePreview value from the DB. Returns null for empty values.
   *  Gracefully falls back to the raw string if decryption fails (legacy rows, corrupt payloads). */
  private _decryptPreview(storedValue: unknown): string | null {
    if (storedValue == null || storedValue === '') return null;
    if (typeof storedValue !== 'string') return null;
    // Only values with the IV:ciphertext `:` structure are encrypted; anything else
    // is returned as-is (covers short placeholders such as '[attachment]' during tests
    // or older rows that were inserted before the encryption rule landed).
    if (!storedValue.includes(':')) return storedValue;
    try {
      const aesKey = this._appConfigSvc.get(AppConfig.AES_KEY).aes_key;
      const decrypted = decrypt(storedValue, aesKey);
      return typeof decrypted === 'string' ? decrypted : null;
    } catch {
      return storedValue;
    }
  }

  /** Encrypt a plaintext preview string (used internally when writing synthesized values). */
  private _encryptPreview(plainPreview: string): string {
    const aesKey = this._appConfigSvc.get(AppConfig.AES_KEY).aes_key;
    return encrypt(plainPreview, aesKey);
  }

  private _getOtherUserIdFromChatId(chatId: string, currentUserId: string): string | null {
    if (!chatId.startsWith('direct:')) return null;
    const ids = chatId.slice('direct:'.length).split(':');
    if (ids.length !== 2) return null;
    const [idA, idB] = ids;
    if (idA === currentUserId) return idB;
    if (idB === currentUserId) return idA;
    return null;
  }

  //#region Mark Direct Chat As Read
  async markDirectChatAsRead(userId: Types.ObjectId, otherUserId: Types.ObjectId): Promise<AppResponse> {
    try {
      const updated = await this._metaSchema.findOneAndUpdate(
        {
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.OtherUserId]: otherUserId
        },
        { $set: { [DirectChatMeta_Keys.LastReadAt]: currentDate() } },
        // Merely opening an empty conversation must not create a chat-list
        // entry. The metadata row is created after the first message is sent.
        { new: true, upsert: false }
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
      const defaultNeverReadAt = '1970-01-01T00:00:00.000Z';
      const pairA = this._metaSchema.findOneAndUpdate(
        {
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.OtherUserId]: otherUserId
        },
        {
          $set: {
            [DirectChatMeta_Keys.LastMessagePreview]: preview,
            [DirectChatMeta_Keys.LastMessageAt]: now
          },
          $setOnInsert: {
            [DirectChatMeta_Keys.LastReadAt]: defaultNeverReadAt
          }
        },
        { new: true, upsert: true }
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
          },
          $setOnInsert: {
            [DirectChatMeta_Keys.LastReadAt]: defaultNeverReadAt
          }
        },
        { new: true, upsert: true }
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
  async getMyDirectConversations(
    userId: Types.ObjectId,
    options?: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse> {
    try {
      const searchTerm = (options?.search || '').trim();
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;

      // 1. Find all meta rows for this user, sorted by most recent activity
      const metaRows = await this._metaSchema
        .find({
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.LastMessageAt]: { $exists: true, $ne: null }
        })
        .sort({ [DirectChatMeta_Keys.LastMessageAt]: -1 })
        .exec();

      // 2. Collect all other user IDs for a single batch user lookup
      const otherUserIds = metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId]);

      // 3. Batch lookup of other users (name, email) — one query instead of N
      //    If a search term is provided, filter at the DB level (by name OR email, case-insensitive)
      const usersModel = this._metaSchema.db.collection(Collections.Users);
      const userQuery: any = { _id: { $in: otherUserIds } };
      if (searchTerm) {
        const regex = { $regex: searchTerm, $options: 'i' };
        userQuery.$or = [{ [Users_Keys.Name]: regex }, { [Users_Keys.Email]: regex }];
      }
      const otherUsersDocs = await usersModel
        .find(userQuery)
        .project({ [Users_Keys.Name]: 1, [Users_Keys.Email]: 1 })
        .toArray();
      const otherUsersMap = new Map<string, { name: string; email: string }>();
      for (const u of otherUsersDocs) {
        otherUsersMap.set(u._id.toString(), {
          name: u[Users_Keys.Name],
          email: u[Users_Keys.Email]
        });
      }

      // Determine which user IDs matched the search (so we skip non-matching partners)
      const matchedPartnerIds = new Set(otherUsersMap.keys());

      // 4. For each conversation, compute unreadCount and unreadPreview in parallel
      //    Skip rows whose partner did not match the search filter
      const filteredMetaRows = searchTerm
        ? metaRows.filter((r) => matchedPartnerIds.has(r[DirectChatMeta_Keys.OtherUserId].toString()))
        : metaRows;

      const enriched = await Promise.all(
        filteredMetaRows.map(async (row: any) => {
          const otherUserId = row[DirectChatMeta_Keys.OtherUserId];
          const otherUserIdStr = otherUserId.toString();
          const otherUser = otherUsersMap.get(otherUserIdStr) || { name: 'Unknown', email: '' };
          const since = row[DirectChatMeta_Keys.LastReadAt];

          // Count + preview queries — use messagesDao methods (safe, typed, proven)
          const chatId = this._privateChatId(userId, otherUserId);
          const [countRes, previewRes] = await Promise.all([
            this._messagesDao.getUnreadCountForPrivateChat(chatId, userId, since),
            this._messagesDao.getLastUnreadMessagesForPrivateChat(chatId, userId, since, 3)
          ]);

          return {
            userId: userId.toString(),
            otherUserId: otherUserIdStr,
            otherUserName: otherUser.name,
            otherUserEmail: otherUser.email,
            lastReadAt: row[DirectChatMeta_Keys.LastReadAt] || null,
            lastMessagePreview: this._decryptPreview(row[DirectChatMeta_Keys.LastMessagePreview]),
            lastMessageAt: row[DirectChatMeta_Keys.LastMessageAt] || null,
            unreadCount: countRes.data ?? 0,
            unreadPreview: previewRes.data ?? []
          };
        })
      );

      // 5. Also include users we have chatted with via messages but have no meta row yet
      //    (handles historical data before this feature was added)
      const messagesCollection = this._metaSchema.db.collection(Collections.Messages);
      const privateMessages = await messagesCollection
        .find({
          [Messages_Keys.MessageType]: 'private',
          [Messages_Keys.ChatId]: { $regex: '^direct:' }
        })
        .project({ [Messages_Keys.ChatId]: 1 })
        .toArray();

      const existingPartnerIds = new Set(
        metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId].toString())
      );
      const allPartnerIds = new Set<string>();
      for (const message of privateMessages) {
        const otherIdStr = this._getOtherUserIdFromChatId(
          message[Messages_Keys.ChatId],
          userId.toString()
        );
        if (otherIdStr && !existingPartnerIds.has(otherIdStr)) {
          allPartnerIds.add(otherIdStr);
        }
      }

      // For each newly-discovered partner without meta, create a virtual entry
      // When a search term exists, pre-filter partners at the user lookup step too
      if (allPartnerIds.size > 0) {
        const objectIds = Array.from(allPartnerIds).map(
          (id) => new Types.ObjectId(id)
        );
        const missingUserQuery: any = { _id: { $in: objectIds } };
        if (searchTerm) {
          const regex = { $regex: searchTerm, $options: 'i' };
          missingUserQuery.$or = [{ [Users_Keys.Name]: regex }, { [Users_Keys.Email]: regex }];
        }
        const missingUsersDocs = await usersModel
          .find(missingUserQuery)
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

          const chatId = this._privateChatId(userId, otherIdObj);

          // Last message preview — get latest message for this chatId
          const lastMsgList = await messagesCollection
            .find({
              [Messages_Keys.ChatId]: chatId,
              [Messages_Keys.MessageType]: 'private',
            })
            .sort({ [Messages_Keys.CreatedOn]: -1 })
            .limit(1)
            .toArray();
          const lastMsg = lastMsgList[0];
          // Use epoch "0" as since for missing rows — counts ALL messages ever sent
          const sinceEpoch = '1970-01-01T00:00:00.000Z';

          const [countRes, previewRes] = await Promise.all([
            this._messagesDao.getUnreadCountForPrivateChat(
              chatId,
              userId,
              sinceEpoch
            ),
            this._messagesDao.getLastUnreadMessagesForPrivateChat(
              chatId,
              userId,
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
            // This placeholder is virtual (never stored in DirectChatMeta) so it stays plaintext.
            lastMessagePreview: lastMsg ? '[Encrypted message]' : null,
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

      // 7. Apply pagination on the final merged/sorted list and wrap in envelope
      const totalCount = enriched.length;
      const paginated = enriched.slice(offset, offset + limit);

      return createResponse(HttpStatus.OK, messages.S8, {
        totalCount,
        offset,
        limit: paginated.length,
        items: paginated
      });
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
        .find({
          [DirectChatMeta_Keys.UserId]: userId,
          [DirectChatMeta_Keys.LastMessageAt]: { $exists: true, $ne: null }
        })
        .select(`${DirectChatMeta_Keys.OtherUserId}`)
        .exec();
      const ids = new Set<string>(
        metaRows.map((r) => r[DirectChatMeta_Keys.OtherUserId].toString())
      );

      // 2. Also scan Messages for partners without a DirectChatMeta row yet (historical
      // data from before DirectChatMeta existed, or a meta-row write that failed silently).
      // NOTE: new messages only carry chatId (not receiverId), so partners are derived
      // by parsing chatId the same way getMyDirectConversations() does — do not go back
      // to matching on Messages_Keys.SenderId/ReceiverId, those fields are no longer
      // populated for messages created after the chatId migration.
      const messagesCollection = this._metaSchema.db.collection(Collections.Messages);
      const privateMessages = await messagesCollection
        .find({
          [Messages_Keys.MessageType]: 'private',
          [Messages_Keys.ChatId]: { $regex: '^direct:' }
        })
        .project({ [Messages_Keys.ChatId]: 1 })
        .toArray();

      for (const message of privateMessages) {
        const idStr = this._getOtherUserIdFromChatId(
          message[Messages_Keys.ChatId],
          userId.toString()
        );
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
