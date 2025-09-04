import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AlarmOccurrence } from './alarmOccurences.schema';

@Schema({ collection: 'alarms', timestamps: true })
export class Alarms {
  @Prop({ type: Types.ObjectId, ref: 'alarmsConfiguration', required: true })
  alarmConfigId: Types.ObjectId;

  @Prop({ type: Number, default: 1 })
  alarmOccurrenceCount: number;

  // 👇 New field: count of acknowledgements
  @Prop({ type: Number, default: 0 })
  alarmAcknowledgementStatusCount: number;

  @Prop({ type: Date })
  alarmFirstOccurrence?: Date;

  @Prop({ type: Date })
  alarmLastOccurrence?: Date;

  @Prop({
    type: [{ type: Types.ObjectId, ref: AlarmOccurrence.name }],
    default: [],
  })
  alarmOccurrences: Types.ObjectId[];
}

export type AlarmsDocument = Alarms & Document;
export const AlarmsSchema = SchemaFactory.createForClass(Alarms);
export const AlarmsCollectionName = 'alarms';
