import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Historical extends Document {
  @Prop({ required: true })
  tag: string;

  @Prop({ required: true })
  activeEnergy: number;

  @Prop({ required: true })
timestamp: string;
}

export const HistoricalSchema = SchemaFactory.createForClass(Historical);
