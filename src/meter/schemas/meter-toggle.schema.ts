import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterToggleDocument = MeterToggle & Document;

@Schema({ strict: false, collection: 'area-toggle-status'})  //metertoggles   forlocal server

export class MeterToggle {
  @Prop({ required: true })
  meterId: string;

  @Prop({ required: true })
  area: string;

  @Prop({ type: Date, required: true })   // added type date
  startDate: Date;

  @Prop({ type: Date, required: true })   // added type date
  endDate: Date;
}

export const MeterToggleSchema = SchemaFactory.createForClass(MeterToggle);

// ✅ Add indexes *after* SchemaFactory
MeterToggleSchema.index({ meterId: 1 }, { unique: true });


