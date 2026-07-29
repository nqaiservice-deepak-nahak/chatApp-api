import { Module } from '@nestjs/common';
import { GroupsAbstractSvc } from './groups.abstract';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController],
  providers: [
    {
      provide: GroupsAbstractSvc,
      useClass: GroupsService
    }
  ],
  exports: [GroupsAbstractSvc]
})
export class GroupsModule {}
