// src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { ProfileModule } from './profile/profile.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(), // Voor .env ondersteuning
    MongooseModule.forRoot(process.env.CONNECTION_STRING || 'mongodb://localhost:27017/TheCircleA3'), // Database connectie
    EventsModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}