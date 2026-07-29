import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';

class SendMessageDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Message']) })
  @IsString({ message: messageFactory(messages.W1, ['message']) })
  @MaxLength(4000, { message: messageFactory(messages.W4, ['Message', '4000']) })
  readonly message: string;
}

export { SendMessageDto };
