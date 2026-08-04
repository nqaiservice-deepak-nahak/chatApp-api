import { Connection, Document, Schema, SchemaTypes, Types } from 'mongoose';
import { currentDate } from '../../core/utils/timestamp-util';
import { Collections } from '../mongodb/connection/collections.mongo';

//#region Keys
/**
 * Stores the join-time of every member of every group.
 * `joinedAt` is the single source of truth used to filter which messages
 * a member is allowed to see (see MessagesDao.getChatHistory).
 */
const enum GroupMembers_Keys {
  id = '_id',
  GroupId = 'groupId',
  UserId = 'userId',
  UserName = 'userName',
  JoinedAt = 'joinedAt',
  LastReadAt = 'lastReadAt'
}
//#endregion Keys

//#region Interfaces
interface IGroupMember {
  [GroupMembers_Keys.GroupId]: Types.ObjectId;
  [GroupMembers_Keys.UserId]: Types.ObjectId;
  [GroupMembers_Keys.UserName]: string;
  [GroupMembers_Keys.JoinedAt]: string;
  [GroupMembers_Keys.LastReadAt]?: string;
}

interface IGroupMembersModel extends IGroupMember, Document { }
//#endregion Interfaces

//#region Schema
const GroupMembersSchema = new Schema<IGroupMembersModel>({
  [GroupMembers_Keys.GroupId]: { type: SchemaTypes.ObjectId, ref: Collections.Groups, required: true },
  [GroupMembers_Keys.UserId]: { type: SchemaTypes.ObjectId, ref: Collections.Users, required: true },
  [GroupMembers_Keys.UserName]: { type: SchemaTypes.String, required: true, trim: true },
  [GroupMembers_Keys.JoinedAt]: { type: SchemaTypes.String, required: true, default: () => currentDate() },
  [GroupMembers_Keys.LastReadAt]: { type: SchemaTypes.String, required: false }
});
//#endregion Schema

//#region Index
GroupMembersSchema.index({ [GroupMembers_Keys.GroupId]: 1, [GroupMembers_Keys.UserId]: 1 }, { unique: true });
//#endregion Index

const createGroupMembersSchema = (conn: Connection) =>
  conn.model<IGroupMembersModel>(Collections.GroupMembers, GroupMembersSchema, Collections.GroupMembers);

export { createGroupMembersSchema, GroupMembers_Keys, GroupMembersSchema, IGroupMember, IGroupMembersModel };
