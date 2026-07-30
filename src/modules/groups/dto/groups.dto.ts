import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, IsArray, ArrayUnique, ArrayMaxSize, IsMongoId, IsIn } from 'class-validator';
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

  @ApiProperty({ required: false, enum: ['public', 'private'], default: 'public' })
  @IsOptional()
  @IsIn(['public', 'private'], { message: messageFactory(messages.W1, ['group type (public/private)']) })
  readonly type?: 'public' | 'private';

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  readonly memberIds?: string[];
}

class AddGroupMembersDto {
  @ApiProperty({ type: [String] })
  @IsNotEmpty({ message: messageFactory(messages.W2, ['memberIds']) })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  readonly memberIds: string[];
}

class SearchPublicGroupsDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['searchData']) })
  @IsString({ message: messageFactory(messages.W1, ['searchData']) })
  @MaxLength(150, { message: messageFactory(messages.W4, ['Search text', '150']) })
  readonly searchData: string;
}

class TransferGroupOwnershipDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['newOwnerUserId']) })
  @IsMongoId({ message: messageFactory(messages.W1, ['newOwnerUserId']) })
  readonly newOwnerUserId: string;
}

export {
  AddGroupMembersDto,
  CreateGroupDto,
  SearchPublicGroupsDto,
  TransferGroupOwnershipDto
};
