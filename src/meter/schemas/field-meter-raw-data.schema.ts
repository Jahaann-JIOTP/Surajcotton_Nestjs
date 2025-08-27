import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ strict: false, collection: 'field_meter_raw_data1' })
export class FieldMeterRawData extends Document {
  @Prop()
  meterId: string;

  [key: string]: any;

  @Prop({ default: Date.now })
timestamp: Date;

}

export const FieldMeterRawDataSchema = SchemaFactory.createForClass(FieldMeterRawData);
