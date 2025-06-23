import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import {Stream, StreamDocument} from "./stream.schema";
import {Actor, IStream} from "./stream.interface";

@Injectable()
export class StreamService {
    constructor(@InjectModel(Stream.name) private streamModel: Model<StreamDocument>) {
    }

    async createStream(createStreamDto: IStream): Promise<Stream> {
        const createdStream = new this.streamModel(createStreamDto);
        return createdStream.save();
    }

    async createEvent(streamerId: Types.ObjectId, event: {
        id: Types.ObjectId,
        actor: Actor,
        event: string,
        tags: string[];
    }): Promise<Stream> {
        const stream = await this.streamModel.findOne({ streamerId });
        if (!stream) {
            throw new Error('Stream not found');
        }
        stream.events.push({
            ...event,
            timeStamp: new Date(),
        });
        return stream.save();
    }

    async doesStreamExist(streamerId: Types.ObjectId): Promise<boolean> {
        return await this.streamModel.countDocuments({streamerId}).exec() > 0;
    }
}
