import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { AuthAbstractSvc } from './auth.abstract';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly _authService: AuthAbstractSvc) { }

  //#region Register
  @Post('register')
  async register(@Body() userInfo: RegisterDto): Promise<AppResponse> {
    return await this._authService.register(userInfo);
  }
  //#endregion Register

  //#region Login
  @Post('login')
  async login(@Body() loginInfo: LoginDto): Promise<AppResponse> {
    return await this._authService.login(loginInfo);
  }
  //#endregion Login

  //#region Get My Profile
  @Authorize()
  @ApiBearerAuth()
  @Get('me')
  async getProfile(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._authService.getProfile(claims.userId);
  }
  //#endregion Get My Profile

  //#region get Available Users
  @Authorize()
  @ApiBearerAuth()
  @Get('available-users')
  async getAvailableUsers(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._authService.getAvailableUsers(claims.userId);
  }
  //#endregion
}
