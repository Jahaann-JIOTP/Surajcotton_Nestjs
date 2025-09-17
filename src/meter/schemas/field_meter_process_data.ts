import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FieldMeterProcessDataDocument = FieldMeterProcessData & Document;

@Schema({ timestamps: false, collection: 'field_meter_process_data', strict: false })
export class FieldMeterProcessData {
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



  // field_meter_raw_data.schema.ts
// @Schema({ timestamps: false, collection: 'field_meter_raw_data', strict: false })
// export class FieldMeterProcessData extends Document {
//   @Prop({ type: String, required: true, index: true, unique: true })
//   minuteKey: string;  // e.g. "2025-08-24T15:27"

//   @Prop({ default: Date.now })
//   timestamp: Date;

//   @Prop({ type: String, required: true, enum: ['cron','toggle'], default: 'cron' })
//   source: 'cron' | 'toggle';
// }
// export const FieldMeterProcessDataSchema =
//   SchemaFactory.createForClass(FieldMeterProcessData);
// (ensure indexes are built at startup) await model.syncIndexes();
