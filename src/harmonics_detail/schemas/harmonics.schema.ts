import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema( { strict: false } ) // Flexible for dynamic fields
export class HarmonicsDetailEntry extends Document
{
  @Prop()
  timestamp: Date;
}

export const HarmonicsDetailSchema = SchemaFactory.createForClass( HarmonicsDetailEntry );
