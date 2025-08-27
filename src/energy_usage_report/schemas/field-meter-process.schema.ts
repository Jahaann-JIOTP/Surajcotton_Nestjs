import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as moment from 'moment-timezone';

@Schema({ collection: 'field_meter_process_data1', timestamps: true })
export class FieldMeterProcess extends Document {
  @Prop({ required: true, index: true })
  meterId: string; // The identifier for the field meter (like U4_U23_GW03)

  @Prop({ 
    type: Map, 
    of: {
      fV: { type: Number },  // First value (e.g., starting value for energy reading)
      lV: { type: Number },  // Last value (e.g., ending value for energy reading)
      CONS: { type: Number }, // Consumption value (e.g., calculated consumption)
    },
    required: true,
  })
  meters: Map<string, { fV: number, lV: number, CONS: number }>; // Stores all meters' consumption data

@Prop({
    type: Date,
    default: () => moment().tz('Asia/Karachi').toDate(),
  })
  timestamp: Date;

}

export const FieldMeterProcessSchema = SchemaFactory.createForClass(FieldMeterProcess);
