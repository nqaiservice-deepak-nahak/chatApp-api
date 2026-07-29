import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
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

export { LoginDto, RegisterDto };
