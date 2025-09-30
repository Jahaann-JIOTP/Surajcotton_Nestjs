import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';


//changed collection names
@Schema({ strict: false, collection: 'FM_raw33' })
export class FieldMeterRawData extends Document {
  @Prop()
  meterId: string;
  [key: string]: any;

  @Prop()
  timestamp: string;

}

export const FieldMeterRawDataSchema = SchemaFactory.createForClass(FieldMeterRawData);
