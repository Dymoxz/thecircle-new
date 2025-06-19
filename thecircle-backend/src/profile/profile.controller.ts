// src/profile/profile.controller.ts
import { Controller, Get,Request, Post, Delete, Param, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from '../auth/auth.guards';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(AuthGuard)
  @Get(':userId')
  async getProfile(@Param('userId') userId: string) {
    return this.profileService.getUserProfile(userId);
  }

  @UseGuards(AuthGuard) // Protect this route with your AuthGuard
  @Get() // No userId parameter in the URL
  async getMyProfile(@Request() req) {
    const userId = req.user.sub;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token.');
    }
    return this.profileService.getUserProfile(userId);
  }

  @Post('subscribe')
  @UseGuards(AuthGuard)
  async subscribe(
    @Request() req,
    @Body('streamerId') streamerId: string,
  ) {
    console.log("aaaaaa" + streamerId);
    return this.profileService.subscribe(req.user.sub, streamerId);
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