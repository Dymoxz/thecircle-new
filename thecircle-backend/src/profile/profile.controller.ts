// src/profile/profile.controller.ts
import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId')
  async getProfile(@Param('userId') userId: string) {
    return this.profileService.getUserProfile(userId);
  }

  @Post('subscribe')
  async subscribe(
    @Body('subscriberId') subscriberId: string,
    @Body('streamerId') streamerId: string,
  ) {
    return this.profileService.subscribe(subscriberId, streamerId);
  }

  @Delete('unsubscribe')
  async unsubscribe(
    @Body('subscriberId') subscriberId: string,
    @Body('streamerId') streamerId: string,
  ) {
    return this.profileService.unsubscribe(subscriberId, streamerId);
  }

  @Get('is-subscribed/:subscriberId/:streamerId')
  async isSubscribed(
    @Param('subscriberId') subscriberId: string,
    @Param('streamerId') streamerId: string,
  ) {
    return { exists: await this.profileService.isSubscribed(subscriberId, streamerId) };
  }

  @Get('subscribers/:streamerId')
  async getSubscribers(@Param('streamerId') streamerId: string) {
    return this.profileService.getSubscribers(streamerId);
  }

  @Get('subscriptions/:subscriberId')
  async getSubscriptions(@Param('subscriberId') subscriberId: string) {
    return this.profileService.getSubscriptions(subscriberId);
  }
}