// src/profile/schemas/subscription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  subscriber: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  streamer: Types.ObjectId;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);