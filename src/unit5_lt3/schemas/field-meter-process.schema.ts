
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as moment from 'moment-timezone';

interface MeterData {
  fV: number;
  lV: number;
  CONS: number;
  cumulative_con: number;
  lastNonZeroTime?: Date;
}

@Schema({ collection: 'FM_process', timestamps: true })    // FM_process   for local server  // for production FM_Process_Prod
export class FieldMeterProcess extends Document {
  @Prop({ type: Date, default: () => moment().tz('Asia/Karachi').toDate() })
  timestamp: Date;

  // Store dynamic meter fields in a dedicated object
  @Prop({ type: Object })
  meters?: Record<string, MeterData>;
}

export const FieldMeterProcessSchema = SchemaFactory.createForClass(FieldMeterProcess);
