import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { messageFactory, messages } from '../../../shared/messages.shared';

class RegisterDto {
  @ApiProperty()
  @Transform(({ value }) =>typeof value === 'string' ? value.trim() : value)
  @IsString({ message: messageFactory(messages.W1, ['name']) })
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Name']) })
  @MaxLength(100, { message: messageFactory(messages.W4, ['Name', '100']) })
  readonly name: string;

  @ApiProperty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Email']) })
  @IsEmail({}, { message: messageFactory(messages.W1, ['email']) })
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['Password']) })
  @IsString({ message: messageFactory(messages.W1, ['password']) })
  @MaxLength(64, {
    message: 'Password cannot exceed 64 characters.',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=<>])[A-Za-z\d@$!%*?&#^()_\-+=<>]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
    },
  )
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

class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty({ message: messageFactory(messages.W2, ['refreshToken']) })
  @IsString({ message: messageFactory(messages.W1, ['refreshToken']) })
  readonly refreshToken: string;
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

export { LoginDto, PaginatedSearchDto, RegisterDto, RefreshTokenDto };
