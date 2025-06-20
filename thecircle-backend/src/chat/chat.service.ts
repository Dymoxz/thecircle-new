import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';
import { createVerify } from 'crypto';

@Injectable()
export class ChatService {
  constructor(@InjectModel(Chat.name) private chatModel: Model<ChatDocument>) {}

  async create(createChatDto: any): Promise<Chat> {
    const createdChat = new this.chatModel(createChatDto);
    return createdChat.save();
  }

  async verifyMessage(
    publicKeyPem: string,
    dataObj: any,
    signatureB64: string,
  ): Promise<boolean> {
    const dataStr = JSON.stringify(dataObj);
    const signature = Buffer.from(signatureB64, 'base64');

    const verify = createVerify('RSA-SHA256');
    verify.update(dataStr);
    verify.end();

    return verify.verify(publicKeyPem, signature);
  }

  async findByStreamer(streamerId: string): Promise<Chat[]> {
    console.log('Finding chats for streamer:', streamerId);
    return this.chatModel
      .find({ streamer: streamerId })
      .populate('sender streamer')
      .exec();
  }

  async save(chats: Chat[]): Promise<Chat[]> {
    if (!Array.isArray(chats)) {
      throw new Error('Input must be an array of Chat objects');
    }

    for (const obj of chats as any) {
      if (
        obj.signature == undefined ||
        obj.publicKey == undefined ||
        obj.streamId == undefined
      ) {
        throw new Error('Missing digital signature fields');
      }

      const verifyObj = {
        streamId: obj.streamId,
        senderId: obj.sender,
        message: obj.message,
        timestamp: obj.timestamp,
      };

      const publicKeyPem = [
        '-----BEGIN PUBLIC KEY-----',
        obj.publicKey,
        '-----END PUBLIC KEY-----',
      ].join('\n');

      obj.verified = await this.verifyMessage(
        publicKeyPem,
        verifyObj,
        obj.signature,
      );

      delete obj.signature;
      delete obj.publicKey;
      delete obj.streamId;
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
