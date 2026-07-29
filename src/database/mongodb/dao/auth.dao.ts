import AppLogger from '@app/core/loggers/app-logger';
import { AppResponse, createResponse } from '@app/shared/app-response.shared';
import { messages } from '@app/shared/messages.shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { IUser, Users_Keys } from '../../schemas';
import { AbstractAuthDao } from '../abstract/auth.abstract';
import { MongoConstants } from '../connection/constants.mongo';

@Injectable()
export class AuthDao implements AbstractAuthDao {
  constructor(
    private readonly _loggerSvc: AppLogger,
    @Inject(MongoConstants.USERS_SCHEMA) private readonly _userSchema: Model<IUser>
  ) { }

  //#region Find User by Email
  async findUserByEmail(email: string): Promise<AppResponse> {
    try {
      const user = await this._userSchema.findOne({ [Users_Keys.Email]: email.toLowerCase().trim() });
      if (!user) return createResponse(HttpStatus.NOT_FOUND, messages.W5, null);
      return createResponse(HttpStatus.OK, messages.S3, user);
    } catch (error) {
      this._loggerSvc.error(__filename, this.findUserByEmail.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Find User by Email

  //#region Find User by Id
  async findUserById(userId: string): Promise<AppResponse> {
    try {
      const user = await this._userSchema.findById(userId);
      if (!user) return createResponse(HttpStatus.NOT_FOUND, messages.W5, null);
      return createResponse(HttpStatus.OK, messages.S3, user);
    } catch (error) {
      this._loggerSvc.error(__filename, this.findUserById.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Find User by Id

  //#region Create User
  async createUser(userInfo: IUser): Promise<AppResponse> {
    try {
      const user = new this._userSchema({ ...userInfo, [Users_Keys.Email]: userInfo.email.toLowerCase().trim() });
      await user.save();
      return createResponse(HttpStatus.CREATED, messages.S4, user);
    } catch (error) {
      this._loggerSvc.error(__filename, this.createUser.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion Create User

  //#region findAllUsersExcept
  async findAllUsersExcept(userId: string, excludedIds: string[] = []): Promise<AppResponse> {
    try {
      const idsToExclude = Array.from(new Set([userId, ...excludedIds]));
      const users = await this._userSchema
        .find({ _id: { $nin: idsToExclude } })
        .select('-hashedPassword')
        .lean();

      return createResponse(HttpStatus.OK, messages.S8, users.map((u: any) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        createdOn: u.createdOn
      })));
    } catch (error) {
      this._loggerSvc.error(__filename, this.findAllUsersExcept.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
