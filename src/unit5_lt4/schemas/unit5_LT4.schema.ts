import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Unit5LT4 extends Document {
  @Prop() PLC_DATE_TIME: string;

  @Prop() U16_GW03_Del_ActiveEnergy: number;
  @Prop() U17_GW03_Del_ActiveEnergy: number;

  @Prop() U1_GW03_Del_ActiveEnergy: number;
  @Prop() U2_GW03_Del_ActiveEnergy: number;
  @Prop() U3_GW03_Del_ActiveEnergy: number;
  @Prop() U4_GW03_Del_ActiveEnergy: number;
  @Prop() U5_GW03_Del_ActiveEnergy: number;
  @Prop() U6_GW03_Del_ActiveEnergy: number;
  @Prop() U7_GW03_Del_ActiveEnergy: number;
  @Prop() U8_GW03_Del_ActiveEnergy: number;
  @Prop() U9_GW03_Del_ActiveEnergy: number;
  @Prop() U10_GW03_Del_ActiveEnergy: number;
  @Prop() U12_GW03_Del_ActiveEnergy: number;
  @Prop() U14_GW03_Del_ActiveEnergy: number;
  @Prop() U15_GW03_Del_ActiveEnergy: number;
  @Prop() U18_GW03_Del_ActiveEnergy: number;
  @Prop() U19_GW03_Del_ActiveEnergy: number;
  @Prop() U20_GW03_Del_ActiveEnergy: number;
  @Prop() U21_GW03_Del_ActiveEnergy: number;
  @Prop() U22_GW03_Del_ActiveEnergy: number;
  @Prop() U23_GW03_Del_ActiveEnergy: number;



}

export const Unit5LT4Schema = SchemaFactory.createForClass(Unit5LT4);
