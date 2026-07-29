import { HttpStatus, Injectable } from '@nestjs/common';
import { createResponse } from '../../shared/app-response.shared';
import { messages } from '../../shared/messages.shared';

@Injectable()
export class AppService {
  getHealth() {
    return createResponse(HttpStatus.OK, messages.S3, { status: 'up' });
  }
}
