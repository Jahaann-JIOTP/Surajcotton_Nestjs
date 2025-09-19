import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterToggleDocument = MeterToggle & Document;

@Schema()
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









