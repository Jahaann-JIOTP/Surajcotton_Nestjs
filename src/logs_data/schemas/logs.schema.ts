import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ strict: false }) // Flexible for dynamic fields
export class LogEntry extends Document {
  @Prop()
  timestamp: Date;
}

export const LogEntrySchema = SchemaFactory.createForClass(LogEntry);
