import { Document } from 'mongoose';

export interface IUser {
  email: String;
  userName: String;
  password: String;
  birthdate: Date;
  followerCount: Number;
}

// export class User implements IUser {
//   constructor() {}

//   email!: string;
//   userName!: string;
//   password!: string;
//   birthdate!: Date;
//   followerCount!: Number;
// }
