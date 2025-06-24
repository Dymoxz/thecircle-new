import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ObjectId } from 'mongoose';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('stream/:streamerId')
  async findByStreamer(@Param('streamerId') streamerId: string) {
    console.log('Finding chats controller for streamer:', streamerId);
    return this.chatService.findByStreamer(streamerId);
  }

  @Get()
  async findAll() {
    return this.chatService.findAll();
  }

  @Post('save')
  async save(@Body() chats: any[]) {
    if (!Array.isArray(chats)) {
      throw new Error('Input must be an array of Chat objects');
    }
    return this.chatService.save(chats);
  }
}
