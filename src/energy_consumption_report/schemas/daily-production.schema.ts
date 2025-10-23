import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'daily_production' })
export class DailyProduction extends Document {
  @Prop()
  unit: string;

  @Prop()
  date: string; // "YYYY-MM-DD"

  @Prop()
  value: number;
}

export const DailyProductionSchema = SchemaFactory.createForClass(DailyProduction);
