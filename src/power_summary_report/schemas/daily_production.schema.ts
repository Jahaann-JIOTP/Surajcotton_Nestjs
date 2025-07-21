import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyProductionDocument = DailyProduction & Document;

@Schema({ collection: 'daily_production' })
export class DailyProduction {
  @Prop() area: string;
  @Prop() date: Date;
  @Prop() spindles: number;
}

export const DailyProductionSchema = SchemaFactory.createForClass(DailyProduction);
