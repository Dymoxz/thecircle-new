import { Module } from '@nestjs/common';
import { MediasoupGateway } from './mediasoup.gateway';
import { MediasoupService } from './mediasoup.service';
import { UserService } from '../user/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // <--- Add this
  ],
  providers: [MediasoupService, MediasoupGateway, UserService],
  exports: [MediasoupService],
})
export class MediasoupModule {}
