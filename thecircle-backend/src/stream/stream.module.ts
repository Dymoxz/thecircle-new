import {Module} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {User, UserSchema} from '../user/user.schema';
import {Stream, StreamSchema} from "./stream.schema";
import {StreamService} from "./stream.service";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Stream.name, schema: StreamSchema},
            {name: User.name, schema: UserSchema},
        ]),
    ],
    controllers: [],
    providers: [StreamService],
    exports: [StreamService],
})
export class StreamModule {
}
