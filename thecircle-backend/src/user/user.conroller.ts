import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { IUser } from './user.interface';
import { AuthGuard } from 'src/auth/auth.guards';
import { User } from './user.decorator'; // adjust import path

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':email')
  async findOne(@Param('email') email: string): Promise<IUser | null> {
    return this.userService.getUser(email);
  }

  @Post('registerPubKey')
  async registerPubKey(@Body() obj: any, @User() user: any): Promise<Boolean> {

    return this.userService.registerPubKey(obj, user._id);
  }
}
