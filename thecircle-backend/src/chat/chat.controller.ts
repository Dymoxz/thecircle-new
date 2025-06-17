import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ObjectId } from 'mongoose';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async create(@Body() createChatDto: any) {
    return this.chatService.create(createChatDto);
  }

  @Get('stream/:streamerId')
  async findByStreamer(@Param('streamerId') streamerId: string) {
    console.log('Finding chats controller for streamer:', streamerId);
    return this.chatService.findByStreamer(streamerId);
  }

  @Get()
  async findAll() {
    return this.chatService.findAll();
  }
}
