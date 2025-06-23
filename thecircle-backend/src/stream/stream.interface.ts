import { Types } from 'mongoose';

export enum Actor {
    STREAMER = 'streamer',
    VIEWER = 'viewer',
}

export interface IEvent {
    id: Types.ObjectId;
    actor: Actor;
    tags?: string[];
    event: string;
    timeStamp: Date;
}

export interface IStream {
    streamerId: Types.ObjectId;
    events?: IEvent[];
}
