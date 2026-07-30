import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
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

/**
 * Message content shape. Only `text` is used for now — `imagePath` and `files`
 * are reserved for upcoming attachment support so this doesn't need another
 * breaking change once that ships.
 */
export class MessageContentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: messageFactory(messages.W1, ['text']) })
  @MaxLength(4000, { message: messageFactory(messages.W4, ['Message text', '4000']) })
  text?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: messageFactory(messages.W1, ['imagePath']) })
  imagePath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: messageFactory(messages.W1, ['files']) })
  files?: string;
}

export class SendMessageDto {
  @ApiProperty({ type: MessageContentDto })
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Message']) })
  @ValidateNested()
  @Type(() => MessageContentDto)
  readonly message: MessageContentDto;
}

export class SendPrivateMessageDto extends SendMessageDto {
  @IsMongoId()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Receiver userId']) })
  receiverId: string;
}