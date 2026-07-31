import { AppResponse } from '../../shared/app-response.shared';
import { AtPayload } from '../../shared/model.shared';
import { GetChatHistoryDto, GetPrivateChatHistoryDto, MessageContentDto, PaginatedSearchDto } from './dto/messages.dto';

export abstract class MessagesAbstractSvc {
  abstract getChatHistory(dto: GetChatHistoryDto,claims: AtPayload): Promise<AppResponse>;
  /** Persists a message and returns it; used by both the REST layer and the socket gateway. */
  abstract sendMessage(groupId: string, message: MessageContentDto, claims: AtPayload): Promise<AppResponse>;
  abstract getPrivateChatHistory(dto: GetPrivateChatHistoryDto, claims: AtPayload): Promise<AppResponse>;
  abstract sendPrivateMessage(receiverId: string, message: MessageContentDto, claims: AtPayload): Promise<AppResponse>;
  abstract getMyDirectConversations(body: PaginatedSearchDto, claims: AtPayload): Promise<AppResponse>;
  abstract markDirectChatAsRead(otherUserId: string, claims: AtPayload): Promise<AppResponse>;
  /** Combined chats endpoint: groups + private convos sorted by lastMessageAt descending. */
  abstract getMyChats(body: PaginatedSearchDto, claims: AtPayload): Promise<AppResponse>;
}