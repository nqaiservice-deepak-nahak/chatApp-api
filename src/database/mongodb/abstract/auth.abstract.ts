import { AppResponse } from '@app/shared/app-response.shared';
import { IUser } from '../../schemas';

export abstract class AbstractAuthDao {
  abstract findUserByEmail(email: string): Promise<AppResponse>;
  abstract findUserById(userId: string): Promise<AppResponse>;
  abstract createUser(userInfo: IUser): Promise<AppResponse>;
  abstract findAllUsersExcept(
    userId: string,
    excludedIds?: string[],
    options?: { search?: string; offset: number; limit: number }
  ): Promise<AppResponse>;
}
