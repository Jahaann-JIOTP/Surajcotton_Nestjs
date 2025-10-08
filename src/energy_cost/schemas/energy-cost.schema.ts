// src/energy-cost/schemas/energy-cost.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' }) // Make sure this matches your MongoDB collection
export class EnergyCost extends Document {
  @Prop()
  timestamp: string;

  // Other fields like meterId_suffix are accessed dynamically
}

export const EnergyCostSchema = SchemaFactory.createForClass(EnergyCost);
