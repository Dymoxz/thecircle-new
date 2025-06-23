// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { IUser } from './user.interface';
import { InjectModel } from '@nestjs/mongoose/dist/common';
import { User as UserModel, UserDocument } from './user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
  ) {}

  async getUser(_id: string): Promise<IUser | null> {
    const user = await this.userModel.findOne({ _id }).exec();
    if (!user) {
      console.log('Item not found');
    }
    return user;
  }

  async getUserById(id: string): Promise<IUser | null> {
    const user = await this.userModel.findOne({ _id: id }).exec();
    if (!user) {
      console.log('Item not found');
    }
    return user;
  }
  async updateSatoshis(userId: string, satoshis: number): Promise<void> {
  await this.userModel.updateOne(
    { _id: userId },
    { $inc: { satoshis } }
  ).exec();
}
}
