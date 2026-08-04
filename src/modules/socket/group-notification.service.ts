import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class GroupNotificationService extends EventEmitter {
  notifyGroupDeleted(groupId: string): void {
    this.emit('groupDeleted', groupId);
  }
}
