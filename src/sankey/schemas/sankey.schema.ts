import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class sankey extends Document {
  @Prop() PLC_DATE_TIME: string;
// HT Generation
  @Prop() U22_PLC_Del_ActiveEnergy: number;
  @Prop() U26_PLC_Del_ActiveEnergy: number;
  // LT Generation
  @Prop() U19_PLC_Del_ActiveEnergy: number;
  @Prop() U11_GW01_Del_ActiveEnergy: number;
   // Solar Generation
  @Prop() U24_GW01_Del_ActiveEnergy: number;
  @Prop() U28_PLC_Del_ActiveEnergy: number;
  @Prop() U6_GW02_Del_ActiveEnergy: number;
  @Prop() U17_GW03_Del_ActiveEnergy: number;

  // Wapda
  @Prop() U27_PLC_Del_ActiveEnergy: number;
  @Prop() U23_GW01_Del_ActiveEnergy: number;


  // @Prop() U1_PLC_Del_ActiveEnergy: number;
  // @Prop() U2_PLC_Del_ActiveEnergy: number;
  // @Prop() U3_PLC_Del_ActiveEnergy: number;
  // @Prop() U4_PLC_Del_ActiveEnergy: number;
  // @Prop() U5_PLC_Del_ActiveEnergy: number;
  // @Prop() U6_PLC_Del_ActiveEnergy: number;
  // @Prop() U7_PLC_Del_ActiveEnergy: number;
  // @Prop() U8_PLC_Del_ActiveEnergy: number;
  // @Prop() U9_PLC_Del_ActiveEnergy: number;
  // @Prop() U10_PLC_Del_ActiveEnergy: number;
  // @Prop() U11_PLC_Del_ActiveEnergy: number;
  // @Prop() U12_PLC_Del_ActiveEnergy: number;
  // @Prop() U13_PLC_Del_ActiveEnergy: number;
  // @Prop() U14_PLC_Del_ActiveEnergy: number;
  // @Prop() U15_PLC_Del_ActiveEnergy: number;
  // @Prop() U16_PLC_Del_ActiveEnergy: number;
  // @Prop() U17_PLC_Del_ActiveEnergy: number;
  // @Prop() U18_PLC_Del_ActiveEnergy: number;
  // @Prop() U20_PLC_Del_ActiveEnergy: number;

}

export const sankeySchema = SchemaFactory.createForClass(sankey);
