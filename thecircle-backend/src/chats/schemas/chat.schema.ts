// src/chats/schemas/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ required: true })
  sender: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  streamer: Types.ObjectId;

  @Prop({ required: true })
  message: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
