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

  async getUserProfile(userName: string): Promise<any> {
    console.log('Fetching profile for:', userName);
    try {
const user = await this.userModel.findOne({ userName: userName }).lean();
console.log('Found user:', user);
      if (!user) return null;
      const isLive = await this.chatModel.exists({ streamer: userName });
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

  async subscribe(subscriberName: string, streamerName: string) {
    console.log("TRYING TO SUBSCRIBE :" + streamerName +  " for user" + subscriberName );
    const subscriber = await this.userModel.findOne({ userName: subscriberName });
    const streamer = await this.userModel.findOne({ userName: streamerName });
    if (!subscriber || !streamer) return null;

    // Ensure arrays are initialized
    if (!subscriber.subscribedTo) subscriber.subscribedTo = [];
    if (!streamer.subscribers) streamer.subscribers = [];
    if (typeof streamer.followerCount !== 'number') streamer.followerCount = 0;

    // Prevent duplicate subscriptions
    if (subscriber.subscribedTo.some((s: any) => s.user.toString() === streamer._id.toString())) {
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

  async unsubscribe(subscriberName: string, streamerName: string) {
    const subscriber = await this.userModel.findOne({ userName: subscriberName });
    const streamer = await this.userModel.findOne({ userName: streamerName });
    if (!subscriber || !streamer) return null;

    if (!subscriber.subscribedTo) subscriber.subscribedTo = [];
    if (!streamer.subscribers) streamer.subscribers = [];
    if (typeof streamer.followerCount !== 'number') streamer.followerCount = 0;

    // Remove streamer from subscriber's subscribedTo
    subscriber.subscribedTo = subscriber.subscribedTo.filter((s: any) => s.user.toString() !== streamer._id.toString());
    // Remove subscriber from streamer's subscribers
    streamer.subscribers = streamer.subscribers.filter((s: any) => s.user.toString() !== subscriber._id.toString());
    streamer.followerCount = Math.max(0, Number(streamer.followerCount) - 1);

    subscriber.markModified('subscribedTo');
    streamer.markModified('subscribers');
    streamer.markModified('followerCount');

    await subscriber.save();
    await streamer.save();
    return { success: true };
  }

  async isSubscribed(subscriberName: string, streamerName: string) {
    const subscriber = await this.userModel.findOne({ userName: subscriberName });
    const streamer = await this.userModel.findOne({ userName: streamerName });
    if (!subscriber || !subscriber.subscribedTo || !streamer) return false;
    return subscriber.subscribedTo.some((s: any) => s.user.toString() === streamer._id.toString()) || false;
  }

  async getSubscribers(streamerName: string) {
    const streamer = await this.userModel
      .findOne({ userName: streamerName })
      .populate('subscribers.user', 'userName email');
    if (!streamer || !streamer.subscribers) return [];
    return streamer.subscribers;
  }

  async getSubscriptions(subscriberName: string) {
    const subscriber = await this.userModel
      .findOne({ userName: subscriberName })
      .populate('subscribedTo.user', 'userName email');
    if (!subscriber || !subscriber.subscribedTo) return [];
    return subscriber.subscribedTo;
  }
}