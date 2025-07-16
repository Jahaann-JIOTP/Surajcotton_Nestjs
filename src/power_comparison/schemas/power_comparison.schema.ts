// prime-historical-data.schema.ts
import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({collection:'historical'})
export class powercomparisonData {
  @Prop({ required: true })
  timestamp: string;

  @Prop()
 U20_GW03_Del_ActiveEnergy?: number;

  @Prop()
  U21_GW03_Del_ActiveEnergy?: number;

  @Prop()
  U23_GW01_Del_ActiveEnergy?: number;

  @Prop()
  U7_GW01_Del_ActiveEnergy?: number;

//   @Prop()
//   U5_Active_Energy_Total_Consumed?: number;
}

export type powercomparisonHistoricalDataDocument =powercomparisonData & Document;
export const  powercomparisonHistoricalDataSchema = SchemaFactory.createForClass(powercomparisonData);
