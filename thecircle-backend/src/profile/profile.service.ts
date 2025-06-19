// src/profile/profile.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from './Schemas/subscription.schema';
import { User } from '../users/schemas/user.schema';
import { Chat } from '../chats/schemas/chat.schema';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Subscription') private subscriptionModel: Model<Subscription>,
    @InjectModel('Chat') private chatModel: Model<Chat>,
  ) {}

async getUserProfile(userId: string) {
  console.log('Fetching profile for:', userId);
  try {
    const user = await this.userModel.findById(userId).lean();
    console.log('Found user:', user);
    const isLive = await this.chatModel.exists({ streamer: userId });
    const subscriberCount = await this.subscriptionModel.countDocuments({ streamer: userId });
    
    return {
      ...user,
      isLive: !!isLive,
      subscriberCount,
    };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    throw error;
  }
}

  async subscribe(subscriberId: string, streamerId: string) {
    const existing = await this.subscriptionModel.findOne({
      subscriber: subscriberId,
      streamer: streamerId,
    });

    if (existing) return existing;

    const subscription = new this.subscriptionModel({
      subscriber: subscriberId,
      streamer: streamerId,
    });

    await this.userModel.findByIdAndUpdate(streamerId, {
      $inc: { followerCount: 1 },
    });

    return subscription.save();
  }

  async unsubscribe(subscriberId: string, streamerId: string) {
    await this.userModel.findByIdAndUpdate(streamerId, {
      $inc: { followerCount: -1 },
    });

    return this.subscriptionModel.deleteOne({
      subscriber: subscriberId,
      streamer: streamerId,
    });
  }

  async isSubscribed(subscriberId: string, streamerId: string) {
    return this.subscriptionModel.exists({
      subscriber: subscriberId,
      streamer: streamerId,
    });
  }

  async getSubscribers(streamerId: string) {
    return this.subscriptionModel
      .find({ streamer: streamerId })
      .populate('subscriber', 'userName email')
      .lean();
  }

  async getSubscriptions(subscriberId: string) {
    return this.subscriptionModel
      .find({ subscriber: subscriberId })
      .populate('streamer', 'userName email')
      .lean();
  }
}