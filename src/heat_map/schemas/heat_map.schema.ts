import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HeatMapDocument = HeatMap & Document;

@Schema()
export class HeatMap {
  @Prop()
  tag: string;

  @Prop()
  PLC_DATE_TIME: string;

  @Prop()
  value: number;
}

export const HeatMapSchema = SchemaFactory.createForClass(HeatMap);
