import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Historical extends Document {
  @Prop()
  timestamp: String;

  // ✅ required fields for Unit4 LT1
  @Prop()
  U21_PLC_Del_ActiveEnergy: number;

  @Prop()
  U19_PLC_Del_ActiveEnergy: number;
}

export const HistoricalSchema = SchemaFactory.createForClass(Historical);
