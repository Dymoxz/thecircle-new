// src/user/user.controller.ts
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

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async findOne(@Param('id') _id: string): Promise<IUser | null> {
    return this.userService.getUser(_id);
  }

  @Get('/id/:id')
  async findOneById(@Param('id') id: string): Promise<IUser | null> {
    return this.userService.getUserById(id);
  }
}
