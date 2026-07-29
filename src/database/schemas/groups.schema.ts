import { Connection, Document, Schema, SchemaTypes, Types } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
const enum Groups_Keys {
  id = '_id',
  Name = 'name',
  Description = 'description',
  CreatedBy = 'createdBy',
  CreatedByName = 'createdByName',
  CreatedOn = 'createdOn'
}
//#endregion Keys

//#region Interfaces
interface IGroup {
  [Groups_Keys.Name]: string;
  [Groups_Keys.Description]?: string;
  [Groups_Keys.CreatedBy]: Types.ObjectId;
  [Groups_Keys.CreatedByName]: string;
  [Groups_Keys.CreatedOn]: string;
}

interface IGroupsModel extends IGroup, Document {}
//#endregion Interfaces

//#region Schema
const GroupsSchema = new Schema<IGroupsModel>({
  [Groups_Keys.Name]: { type: SchemaTypes.String, required: true },
  [Groups_Keys.Description]: { type: SchemaTypes.String, required: false, default: '' },
  [Groups_Keys.CreatedBy]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [Groups_Keys.CreatedByName]: { type: SchemaTypes.String, required: true },
  [Groups_Keys.CreatedOn]: { type: SchemaTypes.String, required: true, default: () => currentDate() }
});
//#endregion Schema

const createGroupsSchema = (conn: Connection) => conn.model<IGroupsModel>(Collections.Groups, GroupsSchema, Collections.Groups);

export { createGroupsSchema, Groups_Keys, GroupsSchema, IGroup, IGroupsModel };
