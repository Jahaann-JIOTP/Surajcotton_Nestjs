// src/heat_map/schemas/transformer.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransformerInputDocument = TransformerInput & Document;

@Schema({
  collection: 'trafos_input_values',
  timestamps: true, // ✅ will auto-add createdAt and updatedAt
})
export class TransformerInput {
  @Prop({ required: true, enum: ['T1', 'T2', 'T3', 'T4'] })
  transformerName: string;

  @Prop({ required: true, type: Number })
  value: number;
}

export const TransformerInputSchema = SchemaFactory.createForClass(TransformerInput);
