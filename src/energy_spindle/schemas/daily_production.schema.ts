// src/energy-spindle/schemas/daily_production.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyProductionDocument = DailyProduction & Document;

@Schema({ collection: 'daily_production' })
export class DailyProduction {
  @Prop({ required: true })
  date: string; // Format: YYYY-MM-DD

  @Prop({ required: true })
  unit: string; // U4 or U5

  @Prop({ required: true })
  value: number;

  
}

export const DailyProductionSchema = SchemaFactory.createForClass(DailyProduction);
