import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
import { User } from '../user/user.schema';

export type ChatDocument = Chat & Document;

@Schema()
export class Chat {
  @Prop({ type: String, required: true })
  sender: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  streamer: Types.ObjectId;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
