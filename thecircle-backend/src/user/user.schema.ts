import { IUser } from './user.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsMongoId } from 'class-validator';

export type UserDocument = User & Document;

@Schema()
export class User implements IUser {
  @IsMongoId()
  _id!: string;

  @Prop({
    required: true,
    type: String,
  })
  userName!: string;

  @Prop({
    required: true,
    type: String,
  })
  email!: string;

  @Prop({
    required: true,
    type: String,
  })
  password!: string;

  @Prop({
    required: true,
    type: Date,
  })
  birthdate!: Date;

  @Prop({
    required: true,
    type: Number,
  })
  followerCount!: Number;
}

export const UserSchema = SchemaFactory.createForClass(User);
