import { AppConfig, AppConfigService } from '@app/config/app-config.service';
import AppLogger from '@app/core/loggers/app-logger';
import { AbstractAuthDao } from '@app/database/mongodb/abstract/auth.abstract';
import { AbstractDirectChatMetaDao } from '@app/database/mongodb/abstract/direct-chat-meta.abstract';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { AtPayload } from '@app/shared/model.shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AuthAbstractSvc } from './auth.abstract';
import { LoginDto, PaginatedSearchDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements AuthAbstractSvc {
  constructor(
    private readonly _loggerSvc: AppLogger,
    private readonly _authDao: AbstractAuthDao,
    private readonly _directChatMetaDao: AbstractDirectChatMetaDao,
    private readonly _jwtService: JwtService,
    private readonly _appConfigSvc: AppConfigService
  ) { }

  //#region Register
  async register(userInfo: RegisterDto): Promise<AppResponse> {
    try {
      const existing = await this._authDao.findUserByEmail(userInfo.email);
      if (existing.code === HttpStatus.OK) return createResponse(HttpStatus.CONFLICT, messages.W6);

      const hashedPassword = await bcrypt.hash(userInfo.password, 10);
      const createRes = await this._authDao.createUser({
        name: userInfo.name.trim(),
        email: userInfo.email,
        hashedPassword,
        createdOn: undefined as any
      });

      if (createRes.code !== HttpStatus.CREATED) return createRes;

      return createResponse(HttpStatus.CREATED, messages.S4, this._toSafeUser(createRes.data));
    } catch (error) {
      this._loggerSvc.error(__filename, this.register.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Register

  //#region Login
  async login(loginInfo: LoginDto): Promise<AppResponse> {
    try {

      const userRes = await this._authDao.findUserByEmail(loginInfo.email);
      if (userRes.code !== HttpStatus.OK) return createResponse(HttpStatus.UNAUTHORIZED, messages.W7);

      const user = userRes.data;
      const isMatch = await bcrypt.compare(loginInfo.password, user.hashedPassword);
      if (!isMatch) return createResponse(HttpStatus.UNAUTHORIZED, messages.W7);

      const { accessTokenSecret, accessTokenExpiresIn, refreshTokenSecret, refreshTokenExpiresIn } = this._appConfigSvc.get(AppConfig.JWT);
      const payload = { userId: user._id.toString(), name: user.name, email: user.email };
      const accessToken = await this._jwtService.signAsync(payload, {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpiresIn as any
      });
      const refreshToken = await this._jwtService.signAsync(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpiresIn as any
      });
      const { aes_key } = this._appConfigSvc.get(AppConfig.AES_KEY);

      return createResponse(HttpStatus.OK, messages.S5, {
        accessToken,
        refreshToken,
        aesKey: aes_key,
        user: this._toSafeUser(user)
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.login.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Login

  //#region Refresh Token
  async refreshToken(body: RefreshTokenDto): Promise<AppResponse> {
    try {
      const {
        accessTokenSecret,
        accessTokenExpiresIn,
        refreshTokenSecret
      } = this._appConfigSvc.get(AppConfig.JWT);

      const payload = await this._jwtService.verifyAsync(body.refreshToken, {
        secret: refreshTokenSecret
      });

      const newAccessToken = await this._jwtService.signAsync(
        { userId: payload.userId, name: payload.name, email: payload.email },
        { secret: accessTokenSecret, expiresIn: accessTokenExpiresIn as any }
      );

      return createResponse(HttpStatus.OK, messages.S15, {
        accessToken: newAccessToken,
        // Keep the original token so its original `exp` remains the hard
        // session boundary. Refreshing access must not extend the session.
        refreshToken: body.refreshToken
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.refreshToken.name, HttpStatus.UNAUTHORIZED, (error as Error).message);
      return createResponse(HttpStatus.UNAUTHORIZED, messages.W10);
    }
  }
  //#endregion Refresh Token

  //#region Get Profile
  async getProfile(userId: string): Promise<AppResponse> {
    try {
      const userRes = await this._authDao.findUserById(userId);
      if (userRes.code !== HttpStatus.OK) return userRes;
      return createResponse(HttpStatus.OK, messages.S3, this._toSafeUser(userRes.data));
    } catch (error) {
      this._loggerSvc.error(__filename, this.getProfile.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Get Profile

  private _toSafeUser(user: any) {
    return { id: user._id, name: user.name, email: user.email, createdOn: user.createdOn };
  }

  //#region getAvailableUsers
  async getAvailableUsers(body: PaginatedSearchDto, claims: AtPayload): Promise<AppResponse> {
    try {
      const userId = claims.userId;
      const offset = body.offset ?? 0;
      const limit = body.limit ?? 50;
      const search = body.searchData?.trim() || undefined;

      const existingPartnersRes = await this._directChatMetaDao.getExistingPartnerIds(new Types.ObjectId(userId));
      const excludedIds = Array.isArray(existingPartnersRes.data) ? existingPartnersRes.data : [];
      // Always exclude self too
      excludedIds.push(userId);

      return await this._authDao.findAllUsersExcept(userId, excludedIds, { search, offset, limit });
    } catch (error) {
      this._loggerSvc.error(__filename, this.getAvailableUsers.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
