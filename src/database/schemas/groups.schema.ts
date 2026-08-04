import { Connection, Document, Schema, SchemaTypes, Types } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
export enum GroupType {
  Public = 'public',
  Private = 'private'
}

const enum Groups_Keys {
  id = '_id',
  Name = 'name',
  Description = 'description',
  Type = 'type',
  CreatedBy = 'createdBy',
  CreatedByName = 'createdByName',
  CreatedOn = 'createdOn'
}
//#endregion Keys

//#region Interfaces
interface IGroup {
  [Groups_Keys.Name]: string;
  [Groups_Keys.Description]?: string;
  [Groups_Keys.Type]: GroupType;
  [Groups_Keys.CreatedBy]: Types.ObjectId;
  [Groups_Keys.CreatedByName]: string;
  [Groups_Keys.CreatedOn]: string;
}

interface IGroupsModel extends IGroup, Document { }
//#endregion Interfaces

//#region Schema
const GroupsSchema = new Schema<IGroupsModel>({
  [Groups_Keys.Name]: { type: SchemaTypes.String, required: true, trim: true},
  [Groups_Keys.Description]: { type: SchemaTypes.String, required: false, default: '', trim: true},
  [Groups_Keys.Type]: {
    type: SchemaTypes.String,
    required: true,
    enum: [GroupType.Public, GroupType.Private],
    default: GroupType.Public
  },
  [Groups_Keys.CreatedBy]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [Groups_Keys.CreatedByName]: { type: SchemaTypes.String, required: true, trim: true },
  [Groups_Keys.CreatedOn]: { type: SchemaTypes.String, required: true, default: () => currentDate() }
});
//#endregion Schema
GroupsSchema.index({[Groups_Keys.CreatedBy]: 1,[Groups_Keys.Name]: 1},{unique: true, collation:{locale:"en", strength:2}});

const createGroupsSchema = (conn: Connection) => conn.model<IGroupsModel>(Collections.Groups, GroupsSchema, Collections.Groups);

export { createGroupsSchema, Groups_Keys, GroupsSchema, IGroup, IGroupsModel };
