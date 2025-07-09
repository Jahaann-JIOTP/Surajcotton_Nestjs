// src/energy/schemas/energy.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnergyDocument = Energy & Document;
@Schema({ collection: 'historical' })

export class Energy {
  @Prop()
  timestamp: string;

  @Prop({ type: Object })
  data: Record<string, number>;
}

export const EnergySchema = SchemaFactory.createForClass(Energy);
