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

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':email')
  async findOne(@Param('email') email: string): Promise<IUser | null> {
    return this.userService.getUser(email);
  }
}
