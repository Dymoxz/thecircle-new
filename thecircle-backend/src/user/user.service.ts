import { Injectable } from '@nestjs/common';
import { IUser } from './user.interface';
import { InjectModel } from '@nestjs/mongoose/dist/common';
import { User as UserModel, UserDocument } from './user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {

    constructor(
        @InjectModel(UserModel.name) private userModel: Model<UserDocument>
    ) {}

  async getUser(email: string): Promise<IUser | null> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
        console.log('Item not found');
    }
    return user; 
  }
}
