import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';


export class GetChatHistoryDto {
  @IsMongoId()
  groupId: string;

  @IsInt()
  @Min(0)
  offset: number;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}

class SendMessageDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Message']) })
  @IsString({ message: messageFactory(messages.W1, ['message']) })
  @MaxLength(4000, { message: messageFactory(messages.W4, ['Message', '4000']) })
  readonly message: string;
}

export { SendMessageDto };
