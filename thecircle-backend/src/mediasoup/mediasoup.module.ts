import { Module } from '@nestjs/common';
import { MediasoupGateway } from './mediasoup.gateway';
import { MediasoupService } from './mediasoup.service';
import { UserService } from '../user/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { UsersModule } from 'src/user/user.module';
import {StreamModule} from '../stream/stream.module';

@Module({
    imports: [
        MongooseModule.forFeature([{name: User.name, schema: UserSchema}]),
        StreamModule,
        UsersModule
    ],
    providers: [MediasoupService, MediasoupGateway, UserService],
    exports: [MediasoupService],
})
export class MediasoupModule {}
