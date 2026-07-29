import { Module } from '@nestjs/common';
import { MessagesAbstractSvc } from './messages.abstract';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  providers: [
    {
      provide: MessagesAbstractSvc,
      useClass: MessagesService
    }
  ],
  exports: [MessagesAbstractSvc]
})
export class MessagesModule {}
