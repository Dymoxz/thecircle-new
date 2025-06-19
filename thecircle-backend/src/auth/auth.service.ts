import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common/exceptions';
import { HttpStatus } from '@nestjs/common/enums';
import { User as UserModel, UserDocument } from '../user/user.schema';
import { JwtService } from '@nestjs/jwt';
import {
  IUser,
  IUserCredentials,
  IUserIdentity,
} from 'src/user/user.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async validateUser(credentials: IUserCredentials): Promise<any> {
    const user = await this.userModel.findOne({
      emailAddress: credentials.email,
    });
    if (user && user.password === credentials.password) {
      return user;
    }
    return null;
  }

  async login(credentials: IUserCredentials): Promise<IUserIdentity> {
    try {
      const user = await this.userModel
        .findOne({ email: credentials.email })
        .select('+password')
        .exec();

      if (!user) {
        throw new UnauthorizedException('Email not found or password invalid');
      }

      const isPasswordValid = await this.verifyPassword(
        credentials.password.toString(),
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Email not found or password invalid');
      }

      const payload = { user_email: user.email, sub: user._id.toString() };

      return {
        _id: user._id,
        email: user.email,
        token: this.jwtService.sign(payload),
      };
    } catch (error) {
      throw error;
    }
  }

  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
