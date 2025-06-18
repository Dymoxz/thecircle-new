import {
  Controller,
  Request,
  Post,
  UseGuards,
  Logger,
  Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { IUserCredentials, IUserIdentity } from '../user/user.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() credentials: IUserCredentials): Promise<IUserIdentity> {
    return await this.authService.login(credentials);
  }
}
