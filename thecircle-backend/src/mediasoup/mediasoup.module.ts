// src/mediasoup/mediasoup.module.ts
import { Module } from '@nestjs/common';
import { MediasoupGateway } from './mediasoup.gateway';
import { MediasoupService } from './mediasoup.service';
import { UserService } from '../user/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { UsersModule } from 'src/user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // <--- Add this
    UsersModule,
  ],
  providers: [MediasoupService, MediasoupGateway, UserService],
  exports: [MediasoupService],
})
export class MediasoupModule {}
