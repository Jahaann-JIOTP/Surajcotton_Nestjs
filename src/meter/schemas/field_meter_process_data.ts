import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'field_meter_process_data' })
export class FieldMeterProcessData extends Document {
  @Prop({
    type: Object, // ✅ Dynamic object jisme meterId ke hisaab se data store hoga
    required: true,
    default: {},
  })
  meters: Record<
    string,
    {
      Unit_4: { firstValue: number; lastValue: number; consumption: number };
      Unit_5: { firstValue: number; lastValue: number; consumption: number };
      lastArea: string; // ✅ Toggle tracking ke liye add kiya
    }
  >;
}

export const FieldMeterProcessDataSchema =
  SchemaFactory.createForClass(FieldMeterProcessData);
