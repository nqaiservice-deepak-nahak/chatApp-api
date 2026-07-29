import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, IsArray, ArrayUnique, ArrayMaxSize, IsMongoId } from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';

class CreateGroupDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Group name']) })
  @IsString({ message: messageFactory(messages.W1, ['group name']) })
  @MaxLength(150, { message: messageFactory(messages.W4, ['Group name', '150']) })
  readonly name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: messageFactory(messages.W1, ['description']) })
  @MaxLength(1000, { message: messageFactory(messages.W4, ['Description', '1000']) })
  readonly description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  readonly memberIds?: string[];
}

export { CreateGroupDto };
