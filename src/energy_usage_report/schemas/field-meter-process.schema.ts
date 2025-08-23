import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as moment from 'moment-timezone';

@Schema({ collection: 'field_meter_process_data', timestamps: true })
export class FieldMeterProcess extends Document {
  @Prop({ required: true, index: true })
  meterId: string;

  @Prop({ required: true, type: Number })
  value: number;  // ✅ Active Energy ya koi bhi reading

@Prop({
    type: Date,
    default: () => moment().tz('Asia/Karachi').toDate(),
  })
  timestamp: Date;

}

export const FieldMeterProcessSchema = SchemaFactory.createForClass(FieldMeterProcess);
