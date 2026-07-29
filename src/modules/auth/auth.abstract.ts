import { AppResponse } from '../../shared/app-response.shared';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export abstract class AuthAbstractSvc {
  abstract register(userInfo: RegisterDto): Promise<AppResponse>;
  abstract login(loginInfo: LoginDto): Promise<AppResponse>;
  abstract getProfile(userId: string): Promise<AppResponse>;
  abstract getAvailableUsers(userId: string): Promise<AppResponse>;
}
