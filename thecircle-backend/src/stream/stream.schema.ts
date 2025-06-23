import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';
import {Actor} from "./stream.interface";

export type StreamDocument = Stream & Document;

@Schema()
export class Event {

    @Prop({type: Types.ObjectId, ref: 'User'})
    id: Types.ObjectId;

    @Prop({type: String, enum: Actor, required: true})
    actor: Actor;

    @Prop({type: [String]})
    tags: string[];

    @Prop({type: String, required: true})
    event: string;

    @Prop({type: Date, default: Date.now, required: true})
    timeStamp: Date;
}

@Schema()
export class Stream {
    @Prop({type: Types.ObjectId, ref: 'User', required: true})
    streamerId: Types.ObjectId;

    @Prop({type: [Event], default: []})
    events: Event[];
}

export const StreamSchema = SchemaFactory.createForClass(Stream);
