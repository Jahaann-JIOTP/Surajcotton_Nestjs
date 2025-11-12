// src/production/schemas/production.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Expose } from 'class-transformer';

export type ProductionDocument = Production & Document;

@Schema({ collection: 'daily_production' })
export class Production {
  @Expose()
  @Prop({ required: true })
  unit: string;

  @Expose()
  @Prop({ required: true })
  date: string;

  @Expose()
  @Prop({ required: true })
  value: number;
  
  @Expose()
  @Prop({ required: true })
  avgcount: number; // 👈 new field
}

export const ProductionSchema = SchemaFactory.createForClass(Production);
