// src/user/user.interface.ts
import {Document, Types} from 'mongoose';

export interface ISubscription {
    user:  Types.ObjectId; // Array of user IDs
    createdAt: Date;
}

export interface IUserCredentials{
  email: String;
  password: String;
}

export interface IUser extends IUserCredentials{
  _id: String;
  userName: String;
  birthdate: Date;
  followerCount: Number;
  satoshis?: number;
  subscribedTo?: ISubscription[];
  subscribers?: ISubscription[];
}

export interface IUserIdentity{
  _id: String;
  email: String;
  token: String;
  userName: String;
}
