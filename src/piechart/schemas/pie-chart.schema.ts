// src/pie-chart/schemas/pie-chart.schema.ts
import { Schema, Document } from 'mongoose';

export const PieChartSchema = new Schema(
  {
    U19_PLC_Del_ActiveEnergy: Number,
    U11_GW01_Del_ActiveEnergy: Number,
    U6_GW02_Del_ActiveEnergy: Number,
    U17_GW03_Del_ActiveEnergy: Number,
    U22_GW01_Del_ActiveEnergy: Number,
    U27_PLC_Del_ActiveEnergy: Number,
    U22_PLC_Del_ActiveEnergy: Number,
    U26_PLC_Del_ActiveEnergy: Number,
    PLC_Date_Time: Date,
    UNIXtimestamp: Number,
  },
  {
    collection: 'historical',
  }
);

export interface PieChart extends Document {
U19_PLC_Del_ActiveEnergy: number;
U11_GW01_Del_ActiveEnergy: number;
U6_GW02_Del_ActiveEnergy: number;
U17_GW03_Del_ActiveEnergy: number;
U22_GW01_Del_ActiveEnergy: number;
U27_PLC_Del_ActiveEnergy: number;
U22_PLC_Del_ActiveEnergy: number;
U26_PLC_Del_ActiveEnergy: number;


 
  PLC_Date_Time: Date;
  UNIXtimestamp: number;
}   


