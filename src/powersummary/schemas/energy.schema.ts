// src/energy/schemas/energy.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnergyDocument = Energy & Document;


@Schema({ collection: 'historical' })
export class Energy {
  @Prop({  required: true })   // ✅ proper Date type
  timestamp: String;

  @Prop({ type: Object })
  data: Record<string, number>;
}


export const EnergySchema = SchemaFactory.createForClass(Energy);
