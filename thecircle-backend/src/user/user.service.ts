import { Injectable } from '@nestjs/common';
import { IUser } from './user.interface';
import { InjectModel } from '@nestjs/mongoose/dist/common';
import { User as UserModel, UserDocument } from './user.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
  ) {}

  async getUser(email: string): Promise<IUser | null> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      console.log('Item not found');
    }
    return user;
  }

  async registerPubKey(obj: any, userId: any): Promise<Boolean> {
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $push: {
          publicKeys: {
            publicKey: obj.publicKey,
            deviceName: obj.deviceName,
          },
        },
      },
    );
    const success = result.modifiedCount > 0;
    return success;
  }
}
