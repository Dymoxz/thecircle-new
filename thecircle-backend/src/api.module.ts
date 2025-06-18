import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import 'dotenv/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { AppModule } from './app.module';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [
    MongooseModule.forRoot(process.env.CONNECTION_STRING!, {
      connectionFactory: (connection) => {
        connection.on('connected', () => {
          console.log(
            `Mongoose db connected to ${process.env.CONNECTION_STRING}`,
          );
        });
        connection._events.connected();
        return connection;
      },
    }),
    UsersModule,
    ChatModule,
    AppModule,
    AuthModule
  ],
  controllers: [],
  providers: [],
})
export class ApiModule {}
