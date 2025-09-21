import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ strict: false, collection: 'FM_raw_data33' })
export class FieldMeterRawData extends Document {
  @Prop()
  meterId: string;
  [key: string]: any;

  @Prop()
  timestamp: string;

}

export const FieldMeterRawDataSchema = SchemaFactory.createForClass(FieldMeterRawData);
