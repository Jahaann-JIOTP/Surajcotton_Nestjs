import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterHistoryDocument = MeterHistory & Document;

@Schema()
export class MeterHistory {
  @Prop({ required: true })
  meterId: string;

  @Prop({ required: true })
  area: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;
}

export const MeterHistorySchema = SchemaFactory.createForClass(MeterHistory);
