// src/user/user.interface.ts
import { Document } from 'mongoose';

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
}

export interface IUserIdentity{
  _id: String;
  email: String;
  token: String;
}
