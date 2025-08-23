import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false, collection: 'field_meter_process_data' })
export class FieldMeterProcessData extends Document {
  @Prop({
    type: Object,
    required: true,
    default: {},
  })
  meters: Record<
    string,
    {
      Unit_4: { firstValue: number; lastValue: number; consumption: number };
      Unit_5: { firstValue: number; lastValue: number; consumption: number };
      lastArea: string; // Toggle tracking ke liye
    }
  >;

  @Prop({
    type: Object,
    required: false, // Optional for flat data
    default: {}, // Default as an empty object
  })
  flatMeters: Record<string, { fV: number; lV: number; CONS: number }> = {}; // Store flattened data

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const FieldMeterProcessDataSchema = SchemaFactory.createForClass(FieldMeterProcessData);
