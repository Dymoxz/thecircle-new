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

  async registerPubKey(obj: any, userId: any): Promise<Boolean> {
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $push: {
          publicKeys: {
            publicKey: obj.publicKey,
            deviceId: obj.deviceId,
          },
        },
      },
    );
    const success = result.modifiedCount > 0;
    return success;
  }

  async getPublicKey(obj: any): Promise<any> {
    const result = await this.userModel.findOne(
      { _id: new Types.ObjectId(obj.userId), 'publicKeys.deviceId': obj.deviceId },
      { publicKeys: { $elemMatch: { deviceId: obj.deviceId } } },
    );

    return result ? result.publicKeys[0] : null;
  }
}
