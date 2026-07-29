import { AppResponse } from '../../shared/app-response.shared';
import { AtPayload } from '../../shared/model.shared';

export abstract class MessagesAbstractSvc {
  abstract getChatHistory(groupId: string, claims: AtPayload): Promise<AppResponse>;
  /** Persists a message and returns it; used by both the REST layer and the socket gateway. */
  abstract sendMessage(groupId: string, text: string, claims: AtPayload): Promise<AppResponse>;
  abstract getPrivateChatHistory(otherUserId: string, claims: AtPayload): Promise<AppResponse>;
  abstract sendPrivateMessage(receiverId: string, text: string, claims: AtPayload): Promise<AppResponse>;
}
