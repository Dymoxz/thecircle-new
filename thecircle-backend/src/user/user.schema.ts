// src/user/user.schema.ts
import {ISubscription, IUser} from './user.interface';
import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {IsMongoId} from 'class-validator';
import {Types} from "mongoose";

export type UserDocument = User & Document;

@Schema()
export class Subscription implements ISubscription {
    @Prop({type: Types.ObjectId, ref: 'User', required: true})
    user: Types.ObjectId;

    @Prop({type: Date, default: Date.now, required: true})
    createdAt: Date;
}

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

    @Prop({default: 0})
    satoshis: number;

    @Prop({required: false, type: []})
    publicKeys: Object[]

    @Prop({type: [Subscription], ref: 'User'})
    subscribedTo: Subscription[];

    @Prop({type: [Subscription], ref: 'User'})
    subscribers: Subscription[];

}

export const UserSchema = SchemaFactory.createForClass(User);
