import { Document, ObjectId } from 'mongoose';

export interface IChat {
  sender: string;
  streamer: ObjectId;
  message: string;
  timestamp: Date;
}
