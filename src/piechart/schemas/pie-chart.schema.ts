// src/pie-chart/schemas/pie-chart.schema.ts
import { Schema, Document } from 'mongoose';

export const PieChartSchema = new Schema(
  {
    U19_PLC_Del_ActiveEnergy: Number,
    U21_PLC_Del_ActiveEnergy: Number,
    U6_GW02_Del_ActiveEnergy: Number,
    U17_GW03_Del_ActiveEnergy: Number,
    U23_GW01_Del_ActiveEnergy: Number,
    U20_GW03_Del_ActiveEnergy: Number,
    U21_GW03_Del_ActiveEnergy: Number,
    U7_GW01_Del_ActiveEnergy: Number,
    PLC_Date_Time: Date,
    UNIXtimestamp: Number,
  },
  {
    collection: 'historical',
  }
);

export interface PieChart extends Document {
U19_PLC_Del_ActiveEnergy: number;
U21_PLC_Del_ActiveEnergy: number;
U6_GW02_Del_ActiveEnergy: number;
U17_GW03_Del_ActiveEnergy: number;
U23_GW01_Del_ActiveEnergy: number;
U20_GW03_Del_ActiveEnergy: number;
U21_GW03_Del_ActiveEnergy: number;
U7_GW01_Del_ActiveEnergy: number;


 
  PLC_Date_Time: Date;
  UNIXtimestamp: number;
}   