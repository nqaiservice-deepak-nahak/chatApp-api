import { Authorize } from '@app/core/decorators/authorization.decorator';
import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { AtPayload } from '@app/shared/model.shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppResponse } from '../../shared/app-response.shared';
import { AuthAbstractSvc } from './auth.abstract';
import { LoginDto, PaginatedSearchDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly _authService: AuthAbstractSvc) { }

  //#region Register
  @Post('register')
  @ApiOperation({summary:'Register a new user account.'})
  async register(@Body() userInfo: RegisterDto): Promise<AppResponse> {
    return await this._authService.register(userInfo);
  }
  //#endregion Register

  //#region Login
  @Post('login')
  @ApiOperation({summary:'Log in and receive an access token.'})
  async login(@Body() loginInfo: LoginDto): Promise<AppResponse> {
    return await this._authService.login(loginInfo);
  }
  //#endregion Login

  //#region Get My Profile
  @Authorize()
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({summary:"Get the current logged-in user's profile."})
  async getProfile(@CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._authService.getProfile(claims.userId);
  }
  //#endregion Get My Profile

  //#region get Available Users
  @Authorize()
  @ApiBearerAuth()
  @Post('available-users')
  @ApiOperation({summary:'List users you can start a new private chat with.'})
  async getAvailableUsers(@Body() body: PaginatedSearchDto, @CurrentUser() claims: AtPayload): Promise<AppResponse> {
    return await this._authService.getAvailableUsers(body, claims);
  }
  //#endregion
}
