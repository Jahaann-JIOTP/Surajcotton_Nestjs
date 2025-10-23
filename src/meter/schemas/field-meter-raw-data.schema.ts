import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ strict: false, collection: 'FM_Raw_Prod'})   // For local server FM_raw   // for production server FM_Raw_Prod
export class FieldMeterRawData extends Document {
  @Prop()
  meterId: string;
  [key: string]: any;

  @Prop()
  timestamp: string;

}

export const FieldMeterRawDataSchema = SchemaFactory.createForClass(FieldMeterRawData);
