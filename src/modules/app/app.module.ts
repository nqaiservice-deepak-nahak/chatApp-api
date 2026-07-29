import { CoreModule } from '@app/core/core.module';
import { AppController } from '@app/modules/app/app.controller';
import { AppService } from '@app/modules/app/app.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { MessagesModule } from '../messages/messages.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [CoreModule, AuthModule, GroupsModule, MessagesModule, SocketModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule { }
