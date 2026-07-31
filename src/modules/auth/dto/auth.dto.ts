import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';

class RegisterDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Name']) })
  @IsString({ message: messageFactory(messages.W1, ['name']) })
  @MaxLength(100, { message: messageFactory(messages.W4, ['Name', '100']) })
  readonly name: string;

  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Email']) })
  @IsEmail({}, { message: messageFactory(messages.W1, ['email']) })
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Password']) })
  @IsString({ message: messageFactory(messages.W1, ['password']) })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  readonly password: string;
}

class LoginDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Email']) })
  @IsEmail({}, { message: messageFactory(messages.W1, ['email']) })
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Password']) })
  @IsString({ message: messageFactory(messages.W1, ['password']) })
  readonly password: string;
}

class PaginatedSearchDto {
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: messageFactory(messages.W1, ['searchData']) })
  @MaxLength(150, { message: messageFactory(messages.W4, ['Search text', '150']) })
  readonly searchData?: string;
}

export { LoginDto, PaginatedSearchDto, RegisterDto };
