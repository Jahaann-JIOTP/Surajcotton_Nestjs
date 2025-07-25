// src/heat_map/schemas/heat_map.schema.ts
// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Document } from 'mongoose';

// export type HeatMapDocument = HeatMap & Document;

// @Schema({ collection: 'historical' })
// export class HeatMap {
//   @Prop()
//   PLC_DATE_TIME: string;

//   @Prop()
//   U21_PLC_Del_ActiveEnergy: number;
// }

// export const HeatMapSchema = SchemaFactory.createForClass(HeatMap);
// prime-historical-data.schema.ts
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

// export type powercomparisonHistoricalDataDocument =powercomparisonData & Document;
export const  HeatMapSchema = SchemaFactory.createForClass(HeatMap);
