import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FieldMeterProcessDataDocument = FieldMeterProcessData & Document;


@Schema({ timestamps: false, collection: 'FM_process ', strict: false })   //FM_process for local server    // for production FM_Process_Prod 
export class FieldMeterProcessData{
  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: 'toggle' })   // or 'cron'
  source: string;

  // Optional: save last area for each meter
  
  // You can save dynamic keys for U4_/U5_ prefixed fields or direct meterIds
  [key: string]: any;  // allows dynamic meter fields
}

export const FieldMeterProcessDataSchema =
  SchemaFactory.createForClass(FieldMeterProcessData);



