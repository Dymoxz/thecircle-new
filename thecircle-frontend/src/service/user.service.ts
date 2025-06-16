// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) {}



    async getUser(email: string): Promise<User[]>{
        try {
            const response = await fetch(`http://localhost:3001/api/user/${email}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user');
            }
            const user = await response.json();
            return user as User;
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
