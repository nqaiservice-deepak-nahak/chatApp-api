import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import AppLogger from '@app/core/loggers/app-logger';
import { GroupsAbstractSvc } from '@app/modules/groups/groups.abstract';
import { MessagesAbstractSvc } from '@app/modules/messages/messages.abstract';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time chat gateway.
 *
 * - Every socket must present a valid JWT (same token used for REST calls)
 *   via `auth: { token }` on connection; unauthenticated sockets are dropped.
 * - `joinGroup` re-verifies (server-side) that the connecting user is a
 *   member of the group before allowing the socket to join the Socket.IO
 *   room, so only members can join a room or receive its messages.
 * - `sendMessage` re-verifies membership again, persists the message via
 *   MessagesAbstractSvc, then broadcasts it to everyone in the room.
 */
@WebSocketGateway({
  path: '/socket.io',
  cors: { origin: '*' }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _jwtService: JwtService,
    private readonly _appConfigSvc: AppConfigService,
    private readonly _groupsService: GroupsAbstractSvc,
    private readonly _messagesService: MessagesAbstractSvc
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.emit('error', { message: 'Authentication token is required.' });
        client.disconnect(true);
        return;
      }

      const secret = this._appConfigSvc.get(AppConfig.JWT)?.accessTokenSecret;
      const payload = await this._jwtService.verifyAsync(token as string, { secret });
      const claims: AtPayload = { userId: payload.userId, name: payload.name, email: payload.email };
      client.data.claims = claims;
      client.join(`user:${claims.userId}`);
      this.server.emit('presenceChanged', { userId: claims.userId, isOnline: true });
    } catch (error) {
      this._loggerSvc.error(__filename, this.handleConnection.name, HttpStatus.UNAUTHORIZED, error.message);
      client.emit('error', { message: 'Invalid or expired token.' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.claims?.userId;
    if (!userId) return;

    const remainingSockets = await this.server.in(`user:${userId}`).fetchSockets();
    this.server.emit('presenceChanged', {
      userId,
      isOnline: remainingSockets.length > 0
    });
  }

  private getConversationRoomName(userIdA: string, userIdB: string): string {
    return `direct:${[userIdA, userIdB].sort().join(':')}`;
  }

  @SubscribeMessage('checkUserPresence')
  async handleCheckUserPresence(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!client.data.claims || !data?.userId) return;

    const sockets = await this.server.in(`user:${data.userId}`).fetchSockets();
    client.emit('userPresence', {
      userId: data.userId,
      isOnline: sockets.length > 0
    });
  }


  //#region join Private Chat
  @SubscribeMessage('joinPrivateChat')
  async handleJoinPrivateChat(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    const claims: AtPayload = client.data.claims;
    if (!claims) return client.emit('error', { message: 'Authentication token is required.' });

    const roomName = this.getConversationRoomName(claims.userId, data.userId);
    client.join(roomName);
    client.emit('joinedPrivateChat', { roomName, otherUserId: data.userId });

    try {
      await this._messagesService.markDirectChatAsRead(data.userId, claims);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._loggerSvc.error(__filename, 'handleJoinPrivateChat', HttpStatus.INTERNAL_SERVER_ERROR, msg);
    }
  }
  //#endregion

  @SubscribeMessage('markPrivateChatRead')
  async handleMarkPrivateChatRead(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    const claims: AtPayload = client.data.claims;
    if (!claims || !data?.userId) return;

    const result = await this._messagesService.markDirectChatAsRead(data.userId, claims);
    if (result.code === HttpStatus.OK) {
      // Keep another open dashboard tab in sync after the active chat reads
      // a message that was just delivered.
      this.server.to(`user:${claims.userId}`).emit('chatListUpdated');
    }
  }

  //#region Join Group Room
  @SubscribeMessage('joinGroup')
  async handleJoinGroup(@MessageBody() data: { groupId: string }, @ConnectedSocket() client: Socket) {
    const claims: AtPayload = client.data.claims;
    if (!claims) return client.emit('error', { message: 'Authentication token is required.' });

    const membershipRes = await this._groupsService.verifyMembership(data.groupId, claims.userId);
    if (membershipRes.code !== HttpStatus.OK) {
      return client.emit('error', { message: membershipRes.message });
    }

    client.join(data.groupId);
    client.emit('joinedGroup', { groupId: data.groupId });

    try {
      await this._groupsService.markGroupAsRead(data.groupId, claims);
    } catch (err) {
      // Log but don't block the join — non-critical
      const msg = err instanceof Error ? err.message : String(err);
      this._loggerSvc.error(__filename, 'handleJoinGroup', HttpStatus.INTERNAL_SERVER_ERROR, msg);
    }
  }
  //#endregion Join Group Room

  //#region Leave Group Room
  @SubscribeMessage('leaveGroup')
  handleLeaveGroup(@MessageBody() data: { groupId: string }, @ConnectedSocket() client: Socket) {
    client.leave(data.groupId);
  }
  //#endregion Leave Group Room

  //#region Send Message
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { groupId: string; message: { text?: string; imagePath?: string; files?: string } },
    @ConnectedSocket() client: Socket
  ) {
    const claims: AtPayload = client.data.claims;
    if (!claims) return client.emit('error', { message: 'Authentication token is required.' });

    if (!data?.message?.text?.trim() && !data?.message?.imagePath?.trim() && !data?.message?.files?.trim()) return;

    const sendRes = await this._messagesService.sendMessage(data.groupId, data.message, claims);
    if (sendRes.code !== HttpStatus.CREATED) {
      return client.emit('error', { message: sendRes.message });
    }

    /*broadcast to everyone currently in the room, including the sender*/
    this.server.to(data.groupId).emit('newMessage', sendRes.data);

    const membersRes = await this._groupsService.getMemberUserIds(data.groupId);
    if (membersRes.code === HttpStatus.OK) {
      for (const memberId of membersRes.data || []) {
        this.server.to(`user:${memberId}`).emit('chatListUpdated');
      }
    }
  }
  //#endregion Send Message

  //#region send Private Message
  @SubscribeMessage('sendPrivateMessage')
  async handleSendPrivateMessage(
    @MessageBody() data: { receiverId: string; message: { text?: string; imagePath?: string; files?: string } },
    @ConnectedSocket() client: Socket
  ) {
    const claims: AtPayload = client.data.claims;
    if (!claims) return client.emit('error', { message: 'Authentication token is required.' });

    const hasContent = !!data?.message?.text?.trim() || !!data?.message?.imagePath?.trim() || !!data?.message?.files?.trim();
    if (!hasContent || !data?.receiverId) return;

    const sendRes = await this._messagesService.sendPrivateMessage(data.receiverId, data.message, claims);
    if (sendRes.code !== HttpStatus.CREATED) {
      return client.emit('error', { message: sendRes.message });
    }

    const roomName = this.getConversationRoomName(claims.userId, data.receiverId);
    this.server.to(roomName).emit('newPrivateMessage', sendRes.data);
    this.server
      .to(`user:${claims.userId}`)
      .to(`user:${data.receiverId}`)
      .emit('chatListUpdated');
  }
  //#endregion
}
