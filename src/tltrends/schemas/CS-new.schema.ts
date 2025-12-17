// src/trends/schemas/cs-new.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

@Schema({ collection: 'historical' })
export class CSNew extends Document {
  @Prop()
  timestamp: string;

  // This allows for any key-value pair like meter_suffix: value
  @Prop({ type: Map, of: mongoose.Schema.Types.Mixed })
  data: Map<string, any>;
}

export const CSNewSchema = SchemaFactory.createForClass(CSNew);
