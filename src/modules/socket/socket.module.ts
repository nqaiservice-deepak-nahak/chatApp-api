import { GroupsModule } from '@app/modules/groups/groups.module';
import { MessagesModule } from '@app/modules/messages/messages.module';
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [GroupsModule, MessagesModule],
  providers: [ChatGateway]
})
export class SocketModule {}
