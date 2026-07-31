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
  async findAllUsersExcept(
    userId: string,
    excludedIds: string[] = [],
    options: { search?: string; offset: number; limit: number } = { offset: 0, limit: 50 }
  ): Promise<AppResponse> {
    try {
      const search = (options.search || '').trim();
      const idsToExclude = Array.from(new Set([userId, ...excludedIds]));

      const query: any = { _id: { $nin: idsToExclude } };
      if (search) {
        const regex = { $regex: search, $options: 'i' };
        query.$or = [{ name: regex }, { email: regex }];
      }

      const totalCount = await this._userSchema.countDocuments(query);
      const users = await this._userSchema
        .find(query)
        .select('-hashedPassword')
        .sort({ name: 1 })
        .skip(options.offset)
        .limit(options.limit)
        .lean();

      return createResponse(HttpStatus.OK, messages.S8, {
        totalCount,
        offset: options.offset,
        limit: users.length,
        items: users.map((u: any) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          createdOn: u.createdOn
        }))
      });
    } catch (error) {
      this._loggerSvc.error(__filename, this.findAllUsersExcept.name, HttpStatus.INTERNAL_SERVER_ERROR, error.stack);
      return createResponse(HttpStatus.INTERNAL_SERVER_ERROR, messages.E2);
    }
  }
  //#endregion
}
