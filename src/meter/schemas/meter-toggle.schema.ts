import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterToggleDocument = MeterToggle & Document;

@Schema()
export class MeterToggle {
  @Prop({ required: true })
  meterId: string;

  @Prop({ required: true })
  area: string;

  @Prop({ required: true })
  startDate: string;

   @Prop({ required: true })
  endDate: string;
}

export const MeterToggleSchema = SchemaFactory.createForClass(MeterToggle);
