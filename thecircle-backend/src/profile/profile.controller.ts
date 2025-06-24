import { Controller, Get,Request, Post, Delete, Param, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from '../auth/auth.guards';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(AuthGuard)
  @Get('getMySubscriptions')
  async getMySubscriptions(@Request() req) {
    const userName = req.user.userName;
    if (!userName) {
      throw new UnauthorizedException('User name not found in token.');
    }
    return this.profileService.getSubscriptions(userName);
  }



  @Post('subscribe')
  @UseGuards(AuthGuard)
  async subscribe(
    @Request() req,
    @Body('streamerName') streamerName: string,
  ) {
    return this.profileService.subscribe(req.user.userName, streamerName);
  }

  @Delete('unsubscribe')
  async unsubscribe(
    @Body('subscriberName') subscriberName: string,
    @Body('streamerName') streamerName: string,
  ) {
    return this.profileService.unsubscribe(subscriberName, streamerName);
  }

  @Get('is-subscribed/:subscriberName/:streamerName')
  async isSubscribed(
    @Param('subscriberName') subscriberName: string,
    @Param('streamerName') streamerName: string,
  ) {
    return { exists: await this.profileService.isSubscribed(subscriberName, streamerName) };
  }

  @Get('subscribers/:streamerName')
  async getSubscribers(@Param('streamerName') streamerName: string) {
    return this.profileService.getSubscribers(streamerName);
  }



  @Get('subscriptions/:subscriberName')
  async getSubscriptions(@Param('subscriberName') subscriberName: string) {
    return this.profileService.getSubscriptions(subscriberName);
  }

  @UseGuards(AuthGuard)
  @Get(':userName')
  async getProfile(@Param('userName') userName: string) {
    return this.profileService.getUserProfile(userName);
  }



  @UseGuards(AuthGuard) // Protect this route with your AuthGuard
  @Get()
  async getMyProfile(@Request() req) {
    const userName = req.user.userName;
    if (!userName) {
      throw new UnauthorizedException('User name not found in token.');
    }
    return this.profileService.getUserProfile(userName);
  }
}