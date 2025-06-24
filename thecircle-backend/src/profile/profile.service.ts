import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import { User, UserDocument } from '../user/user.schema';
import { Chat } from '../chats/schemas/chat.schema';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel('Chat') private chatModel: Model<Chat>,
  ) {}

  async getUserProfile(userId: string): Promise<any> {
    console.log('Fetching profile for:', userId);
    try {
      const user = await this.userModel.findById(userId).lean();
      console.log('Found user:', user);
      if (!user) return null;
      const isLive = await this.chatModel.exists({ streamer: userId });
      const subscriberCount = user.subscribers?.length || 0;
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
    console.log("TRYING TO SUBSCRIBE :" + streamerId +  " for user" + subscriberId );
    const subscriber = await this.userModel.findById(subscriberId);
    const streamer = await this.userModel.findById(streamerId);
    if (!subscriber || !streamer) return null;

    // Ensure arrays are initialized
    if (!subscriber.subscribedTo) subscriber.subscribedTo = [];
    if (!streamer.subscribers) streamer.subscribers = [];
    if (typeof streamer.followerCount !== 'number') streamer.followerCount = 0;

    // Prevent duplicate subscriptions
    if (subscriber.subscribedTo.some((s: any) => s.user.toString() === streamerId)) {
      return { alreadySubscribed: true };
    }

    // Add streamer to subscriber's subscribedTo
    subscriber.subscribedTo.push({ user: new Types.ObjectId(streamer._id), createdAt: new Date() });
    // Add subscriber to streamer's subscribers
    streamer.subscribers.push({ user: new Types.ObjectId(subscriber._id), createdAt: new Date() });
    streamer.followerCount = Number(streamer.followerCount) + 1;

    subscriber.markModified('subscribedTo');
    streamer.markModified('subscribers');
    streamer.markModified('followerCount');

    await subscriber.save();
    await streamer.save();
    return { success: true };
  }

  async unsubscribe(subscriberId: string, streamerId: string) {
    const subscriber = await this.userModel.findById(subscriberId);
    const streamer = await this.userModel.findById(streamerId);
    if (!subscriber || !streamer) return null;

    if (!subscriber.subscribedTo) subscriber.subscribedTo = [];
    if (!streamer.subscribers) streamer.subscribers = [];
    if (typeof streamer.followerCount !== 'number') streamer.followerCount = 0;

    // Remove streamer from subscriber's subscribedTo
    subscriber.subscribedTo = subscriber.subscribedTo.filter((s: any) => s.user.toString() !== streamerId);
    // Remove subscriber from streamer's subscribers
    streamer.subscribers = streamer.subscribers.filter((s: any) => s.user.toString() !== subscriberId);
    streamer.followerCount = Math.max(0, Number(streamer.followerCount) - 1);

    subscriber.markModified('subscribedTo');
    streamer.markModified('subscribers');
    streamer.markModified('followerCount');

    await subscriber.save();
    await streamer.save();
    return { success: true };
  }

  async isSubscribed(subscriberId: string, streamerId: string) {
    const subscriber = await this.userModel.findById(subscriberId);
    if (!subscriber || !subscriber.subscribedTo) return false;
    return subscriber.subscribedTo.some((s: any) => s.user.toString() === streamerId) || false;
  }

  async getSubscribers(streamerId: string) {
    const streamer = await this.userModel.findById(streamerId).populate('subscribers.user', 'userName email');
    if (!streamer || !streamer.subscribers) return [];
    return streamer.subscribers;
  }

  async getSubscriptions(subscriberId: string) {
    const subscriber = await this.userModel.findById(subscriberId).populate('subscribedTo.user', 'userName email');
    if (!subscriber || !subscriber.subscribedTo) return [];
    return subscriber.subscribedTo;
  }
}