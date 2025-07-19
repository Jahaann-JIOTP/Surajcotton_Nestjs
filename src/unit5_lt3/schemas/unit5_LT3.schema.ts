import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Unit5LT3 extends Document {
  @Prop() PLC_DATE_TIME: string;

  @Prop() U13_GW02_Del_ActiveEnergy: number;
  @Prop() U6_GW02_Del_ActiveEnergy: number;

  @Prop() U1_GW02_Del_ActiveEnergy: number;
  @Prop() U2_GW02_Del_ActiveEnergy: number;
  @Prop() U3_GW02_Del_ActiveEnergy: number;
  
  @Prop() U4_GW02_Del_ActiveEnergy: number;
  @Prop() U5_GW02_Del_ActiveEnergy: number;
  @Prop() U7_GW02_Del_ActiveEnergy: number;
  @Prop() U8_GW02_Del_ActiveEnergy: number;
  @Prop() U9_GW02_Del_ActiveEnergy: number;
  @Prop() U10_GW02_Del_ActiveEnergy: number;
  @Prop() U12_GW02_Del_ActiveEnergy: number;
  @Prop() U14_GW02_Del_ActiveEnergy: number;
  @Prop() U15_GW02_Del_ActiveEnergy: number;
  @Prop() U16_GW02_Del_ActiveEnergy: number;
  @Prop() U17_GW02_Del_ActiveEnergy: number;
  @Prop() U18_GW02_Del_ActiveEnergy: number;
  @Prop() U19_GW02_Del_ActiveEnergy: number;
  @Prop() U20_GW02_Del_ActiveEnergy: number;
  @Prop() U21_GW02_Del_ActiveEnergy: number;
  @Prop() U22_GW02_Del_ActiveEnergy: number;
  @Prop() U23_GW02_Del_ActiveEnergy: number;



}

export const Unit5LT3Schema = SchemaFactory.createForClass(Unit5LT3);
