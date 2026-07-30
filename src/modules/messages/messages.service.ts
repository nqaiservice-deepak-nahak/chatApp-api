import AppLogger from '@app/core/loggers/app-logger';
import { AbstractDirectChatMetaDao } from '@app/database/mongodb/abstract/direct-chat-meta.abstract';
import { AbstractGroupsDao } from '@app/database/mongodb/abstract/groups.abstract';
import { AbstractAuthDao } from '@app/database/mongodb/abstract/auth.abstract';
import { AbstractMessagesDao } from '@app/database/mongodb/abstract/messages.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messageFactory, messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MessagesAbstractSvc } from './messages.abstract';
import { GetChatHistoryDto, GetPrivateChatHistoryDto, MessageContentDto } from './dto/messages.dto';
import { decrypt, encrypt } from '@app/core/utils/encrypt.util';
import { AppConfig } from '@app/config/app-config.model';
import { AppConfigService } from '@app/config/app-config.service';

@Injectable()
export class MessagesService implements MessagesAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _appConfigSvc: AppConfigService,
    @Inject(AbstractMessagesDao)
    private readonly _messagesDao: AbstractMessagesDao,
    @Inject(AbstractGroupsDao)
    private readonly _groupsDao: AbstractGroupsDao,
    @Inject(AbstractAuthDao)
    private readonly _authDao: AbstractAuthDao,
    @Inject(AbstractDirectChatMetaDao)
    private readonly _directChatMetaDao: AbstractDirectChatMetaDao
  ) { }

  private _groupChatId(groupId: string): string {
    return `group:${groupId}`;
  }

  private _privateChatId(userIdA: string, userIdB: string): string {
    return `direct:${[userIdA, userIdB].sort().join(':')}`;
  }

  /** Returns a chat-list-safe preview from a stored encrypted message. */
  private _getMessagePreview(encryptedMessage: unknown): string | null {
    if (typeof encryptedMessage !== 'string' || !encryptedMessage) return null;

    try {
      const aesKey = this._appConfigSvc.get(AppConfig.AES_KEY).aes_key;
      const content = decrypt(encryptedMessage, aesKey);
      if (!content || typeof content !== 'object' || typeof (content as { text?: unknown }).text !== 'string') {
        return null;
      }

      return (content as { text: string }).text.trim().slice(0, 100) || null;
    } catch {
      // Legacy/corrupt ciphertext must not make the complete chat list fail.
      return '[Encrypted message]';
    }
  }

  //#region Get Chat History
  /**
   * Enforces the core business rule: a member only sees messages sent on
   * or after the moment they joined this specific group.
   */
  async getChatHistory(dto: GetChatHistoryDto, claims: AtPayload): Promise<AppResponse> {
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

      return await this._messagesDao.getChatHistoryByChatId(
        this._groupChatId(dto.groupId),
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
  async sendMessage(groupId: string, message: MessageContentDto, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(groupId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      // Only `text` is populated for now; imagePath/files are carried through as-is
      // so the object shape is already in place for upcoming attachment support.
      const trimmedText = String(message?.text || '').trim();
      if (!trimmedText) {
        return createResponse(HttpStatus.BAD_REQUEST, messageFactory(messages.W2, ['Message']));
      }

      const messageObject = { text: trimmedText };
      const aesKey = this._appConfigSvc.get(AppConfig.AES_KEY).aes_key;
      const encryptedMessage = encrypt(messageObject, aesKey);
      const membershipRes = await this._groupsDao.isMember(new Types.ObjectId(groupId), new Types.ObjectId(claims.userId));
      if (!membershipRes.data) return createResponse(HttpStatus.FORBIDDEN, messages.W9);

      return await this._messagesDao.createMessage({
        chatId: this._groupChatId(groupId),
        senderId: new Types.ObjectId(claims.userId),
        senderName: claims.name,
        message: encryptedMessage,
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
  async getPrivateChatHistory(dto: GetPrivateChatHistoryDto, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(dto.otherUserId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      return await this._messagesDao.getPrivateChatHistoryByChatId(
        this._privateChatId(claims.userId, dto.otherUserId),
        dto.offset,
        dto.limit
      );
    } catch (error) {
      this._loggerSvc.error(__filename, this.getPrivateChatHistory.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion

  //#region sendPrivateMessage
  async sendPrivateMessage(receiverId: string, message: MessageContentDto, claims: AtPayload): Promise<AppResponse> {
    try {
      if (!Types.ObjectId.isValid(receiverId)) return createResponse(HttpStatus.BAD_REQUEST, messages.W11);

      if (receiverId === claims.userId) {
        return createResponse(HttpStatus.BAD_REQUEST, 'You cannot send a message to yourself.');
      }

      // Req 10: Verify the receiver actually exists before saving the message.
      const receiverRes = await this._authDao.findUserById(receiverId);
      if (receiverRes.code !== HttpStatus.OK) {
        return createResponse(HttpStatus.NOT_FOUND, messages.W5);
      }

      // Only `text` is populated for now; imagePath/files are carried through as-is
      // so the object shape is already in place for upcoming attachment support.
      const trimmedText = String(message?.text || '').trim();
      if (!trimmedText) {
        return createResponse(HttpStatus.BAD_REQUEST, messageFactory(messages.W2, ['Message']));
      }

      const messageObject = { text: trimmedText };
      const aesKey = this._appConfigSvc.get(AppConfig.AES_KEY).aes_key;
      const encryptedMessage = encrypt(messageObject, aesKey);

      const chatId = this._privateChatId(claims.userId, receiverId);
      const sendRes = await this._messagesDao.createMessage({
        chatId,
        senderId: new Types.ObjectId(claims.userId),
        senderName: claims.name,
        message: encryptedMessage,
        messageType: 'private',
        createdOn: undefined as any
      } as any);

      if (sendRes.code === HttpStatus.CREATED) {
        try {
          // Preview cache is still a plain string (used for chat-list previews);
          // fall back to a placeholder when the message is attachment-only.
          const preview = trimmedText ? trimmedText.slice(0, 100) : '[attachment]';
          const cacheRes = await this._directChatMetaDao.updateLastMessageCache(
            new Types.ObjectId(claims.userId),
            new Types.ObjectId(receiverId),
            preview
          );

          if (cacheRes.code !== HttpStatus.OK) {
            this._loggerSvc.error(
              __filename,
              'sendPrivateMessage cacheUpdate',
              HttpStatus.INTERNAL_SERVER_ERROR,
              cacheRes.message
            );
          }
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

  //#region Combined "My Chats" — groups + private conversations merged & sorted by latest activity
  /**
   * Returns one unified list of:
   *   - joined groups (type = 'group') with last-message preview + unreadCount
   *   - existing private conversations (type = 'private') with last-message preview + unreadCount
   * Sorted BY most recent lastMessageAt DESC (WhatsApp-style).
   */
  async getMyChats(claims: AtPayload): Promise<AppResponse> {
    try {
      const userId = new Types.ObjectId(claims.userId);
      const [groupsRes, directRes] = await Promise.all([
        this._groupsDao.getMyGroups(userId),
        this._directChatMetaDao.getMyDirectConversations(userId)
      ]);

      // Normalize groups to chat-item shape
      const groupItems: any[] = (groupsRes.data || []).map((g: any) => ({
        chatType: 'group',
        id: String(g._id || g.id),
        name: g.name,
        description: g.description || null,
        createdBy: g.createdBy || null,
        createdByName: g.createdByName || null,
        createdOn: g.createdOn || null,
        lastMessagePreview: this._getMessagePreview(g.lastMessage?.message),
        lastMessageAt: g.lastMessage?.createdOn ?? g.lastReadAt ?? g.joinedAt ?? null,
        unreadCount: g.unreadCount ?? 0,
        unreadPreview: g.unreadPreview ?? [],
        groupDetails: g
      }));

      // Normalize private conversations to chat-item shape
      const privateItems: any[] = (directRes.data || []).map((c: any) => ({
        chatType: 'private',
        id: String(c.otherUserId),
        name: c.otherUserName,
        description: c.otherUserEmail || null,
        lastMessagePreview: c.lastMessagePreview || null,
        lastMessageAt: c.lastMessageAt || c.unreadPreview?.[c.unreadPreview.length - 1]?.createdOn || c.lastReadAt || null,
        unreadCount: c.unreadCount ?? 0,
        unreadPreview: c.unreadPreview ?? [],
        directDetails: {
          otherUserId: c.otherUserId,
          otherUserName: c.otherUserName,
          otherUserEmail: c.otherUserEmail
        }
      }));

      // Merge + sort by most recent first (stable null/undefined goes to the bottom)
      const merged = [...groupItems, ...privateItems];
      merged.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      return createResponse(HttpStatus.OK, messages.S8, merged);
    } catch (error) {
      this._loggerSvc.error(__filename, this.getMyChats.name, HttpStatus.INTERNAL_SERVER_ERROR, (error as Error).stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
