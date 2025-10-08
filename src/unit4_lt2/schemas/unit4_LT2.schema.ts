import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Unit4LT2 extends Document {
  @Prop() PLC_DATE_TIME: string;

  @Prop() U13_GW01_Del_ActiveEnergy: number;
  @Prop() U11_GW01_Del_ActiveEnergy: number;

  @Prop() U1_GW01_Del_ActiveEnergy: number;
  @Prop() U2_GW01_Del_ActiveEnergy: number;
  @Prop() U3_GW01_Del_ActiveEnergy: number;
  
  @Prop() U4_GW01_Del_ActiveEnergy: number;
  @Prop() U5_GW01_Del_ActiveEnergy: number;
  @Prop() U6_GW01_Del_ActiveEnergy: number;
  @Prop() U7_GW01_Del_ActiveEnergy: number;
  @Prop() U8_GW01_Del_ActiveEnergy: number;
  @Prop() U9_GW01_Del_ActiveEnergy: number;
  @Prop() U10_GW01_Del_ActiveEnergy: number;
  @Prop() U12_GW01_Del_ActiveEnergy: number;
  @Prop() U14_GW01_Del_ActiveEnergy: number;
  @Prop() U15_GW01_Del_ActiveEnergy: number;
  @Prop() U16_GW01_Del_ActiveEnergy: number;
  @Prop() U17_GW01_Del_ActiveEnergy: number;
  @Prop() U18_GW01_Del_ActiveEnergy: number;
  @Prop() U19_GW01_Del_ActiveEnergy: number;
  @Prop() U20_GW01_Del_ActiveEnergy: number;
  @Prop() U21_GW01_Del_ActiveEnergy: number;
  @Prop() U22_GW01_Del_ActiveEnergy: number;
  @Prop() U23_GW01_Del_ActiveEnergy: number;



}

export const Unit4LT2Schema = SchemaFactory.createForClass(Unit4LT2);
