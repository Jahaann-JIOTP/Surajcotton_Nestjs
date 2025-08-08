
import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
export type HeatMapDocument = HeatMap & Document;

@Schema({collection:'historical'})
export class HeatMap {
  @Prop({ required: true })
  timestamp: string;

  @Prop()
 U21_PLC_Del_ActiveEnergy?: number;
}

export const  HeatMapSchema = SchemaFactory.createForClass(HeatMap);
