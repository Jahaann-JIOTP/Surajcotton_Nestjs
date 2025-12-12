import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ strict: false }) // Flexible for dynamic fields
export class HarmonicsReport extends Document {
  @Prop()
  timestamp: Date;
}

export const HarmonicsReportSchema = SchemaFactory.createForClass(HarmonicsReport);
