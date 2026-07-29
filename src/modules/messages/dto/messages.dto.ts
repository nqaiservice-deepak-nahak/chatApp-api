import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';


export class GetChatHistoryDto {
  @IsMongoId()
  groupId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class GetPrivateChatHistoryDto {
  @IsMongoId()
  otherUserId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class SendMessageDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Message']) })
  @IsString({ message: messageFactory(messages.W1, ['message']) })
  @MaxLength(4000, { message: messageFactory(messages.W4, ['Message', '4000']) })
  readonly message: string;
}

export class SendPrivateMessageDto extends SendMessageDto {
  @IsMongoId()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Receiver userId']) })
  receiverId: string;
}
