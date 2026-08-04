import { Connection, Document, Schema, SchemaTypes } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
const enum Users_Keys {
  id = '_id',
  Name = 'name',
  Email = 'email',
  HashedPassword = 'hashedPassword',
  CreatedOn = 'createdOn'
}
//#endregion Keys

//#region Interfaces
interface IUser {
  [Users_Keys.Name]: string;
  [Users_Keys.Email]: string;
  [Users_Keys.HashedPassword]: string;
  [Users_Keys.CreatedOn]: string;
}

interface IUsersModel extends IUser, Document {}
//#endregion Interfaces

//#region Schema
const UsersSchema = new Schema<IUsersModel>({
  [Users_Keys.Name]: { type: SchemaTypes.String, required: true, trim:true },
  [Users_Keys.Email]: { type: SchemaTypes.String, required: true, trim:true, lowercase:true },
  [Users_Keys.HashedPassword]: { type: SchemaTypes.String, required: true },
  [Users_Keys.CreatedOn]: { type: SchemaTypes.String, required: true, default: () => currentDate() }
});
//#endregion Schema

//#region Index
UsersSchema.index({ [Users_Keys.Email]: 1 }, { unique: true });
//#endregion Index

const createUsersSchema = (conn: Connection) => conn.model<IUsersModel>(Collections.Users, UsersSchema, Collections.Users);

export { createUsersSchema, IUser, IUsersModel, Users_Keys, UsersSchema };
