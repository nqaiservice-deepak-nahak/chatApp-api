import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ArrayUnique,
  Max,
  MaxLength,
  Min,
  ArrayNotEmpty
} from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';

class CreateGroupDto {
  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Group name']) })
  @IsString({ message: messageFactory(messages.W1, ['group name']) })
  @MaxLength(150, { message: messageFactory(messages.W4, ['Group name', '150']) })
  readonly name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
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
  @ArrayNotEmpty({ message: messageFactory(messages.W2, ['memberIds']) })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  readonly memberIds: string[];
}

class SearchPublicGroupsDto {
  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
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

class PaginationDto {
  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number = 0;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 50;
}

class PaginatedSearchDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: messageFactory(messages.W1, ['searchData']) })
  @MaxLength(150, { message: messageFactory(messages.W4, ['Search text', '150']) })
  readonly searchData?: string;
}

export {
  AddGroupMembersDto,
  CreateGroupDto,
  PaginatedSearchDto,
  SearchPublicGroupsDto,
  TransferGroupOwnershipDto
};
