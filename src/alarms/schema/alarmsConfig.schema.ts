// alarms.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  AlarmAcknowledgement,
  AlarmAcknowledgementSchema,
} from './alarmsAcknowledgment.schema';
import { AlarmRulesSet } from './alarmsTriggerConfig.schema';

@Schema({ collection: 'alarmsConfiguration' })
export class alarmsConfiguration {
  @Prop({ type: Types.ObjectId, ref: 'AlarmsType', required: true })
  alarmTypeId: Types.ObjectId;

  @Prop({ required: true })
  alarmName: string;

  @Prop({ required: true })
  alarmLocation: string;

  @Prop({ required: true })
  alarmSubLocation: string;

  @Prop({ required: true })
  alarmDevice: string;

  @Prop({ required: true })
  alarmParameter: string;

  // @Prop({ required: true, default: false })
  // alarmStatus: boolean;

  @Prop({ type: [String], default: [] })
  acknowledgementActions: string[];

  // 👇 Reference, not embed
  @Prop({ type: Types.ObjectId, ref: 'AlarmRulesSet', required: true })
  alarmTriggerConfig: AlarmRulesSet | Types.ObjectId;
}

export type AlarmsDocument = alarmsConfiguration & Document;
export const AlarmsConfigurationSchema =
  SchemaFactory.createForClass(alarmsConfiguration);
