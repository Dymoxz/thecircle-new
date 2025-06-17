import { Document } from 'mongoose';

export interface Chat {
  timestamp: Date;
  username: string;
  message: string;
}

export interface IUser {
  email: String;
  userName: String;
  password: String;
  birthdate: Date;
  followerCount: Number;
  chatHistory?: Chat[];
}

// export class User implements IUser {
//   constructor() {}

//   email!: string;
//   userName!: string;
//   password!: string;
//   birthdate!: Date;
//   followerCount!: Number;
// }
