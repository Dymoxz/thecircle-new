import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';

@Injectable()
export class ChatService {
  constructor(@InjectModel(Chat.name) private chatModel: Model<ChatDocument>) {}

  async create(createChatDto: any): Promise<Chat> {
    const createdChat = new this.chatModel(createChatDto);
    return createdChat.save();
  }

  async findByStreamer(streamerId: string): Promise<Chat[]> {
    console.log('Finding chats for streamer:', streamerId);
    return this.chatModel
      .find({ streamer: new Types.ObjectId(streamerId) })
      .populate('sender streamer')
      .exec();
  }

  async save(chats: Chat[]): Promise<Chat[]> {
    if (!Array.isArray(chats)) {
      throw new Error('Input must be an array of Chat objects');
    }
    return this.chatModel.insertMany(chats);
  }

  async findByUser(userId: string): Promise<Chat[]> {
    return this.chatModel
      .find({ sender: userId })
      .populate('sender streamer')
      .exec();
  }

  async findAll(): Promise<Chat[]> {
    return this.chatModel.find().exec();
  }
}
