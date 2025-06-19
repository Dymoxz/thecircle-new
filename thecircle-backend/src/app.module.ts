// src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfileModule } from './profile/profile.module';
import { ConfigModule } from '@nestjs/config';
import { MediasoupModule } from './mediasoup/mediasoup.module';

@Module({
  imports: [
    ConfigModule.forRoot(), // Voor .env ondersteuning
    MongooseModule.forRoot(process.env.CONNECTION_STRING || 'mongodb://localhost:27017/TheCircleA3'), // Database connectie
    MediasoupModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
