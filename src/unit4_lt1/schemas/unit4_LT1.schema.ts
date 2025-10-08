import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'historical' })
export class Unit4LT1 extends Document {
  @Prop() PLC_DATE_TIME: string;

  @Prop() U19_PLC_Del_ActiveEnergy: number;
  @Prop() U21_PLC_Del_ActiveEnergy: number;

  @Prop() U1_PLC_Del_ActiveEnergy: number;
  @Prop() U2_PLC_Del_ActiveEnergy: number;
  @Prop() U3_PLC_Del_ActiveEnergy: number;
  @Prop() U4_PLC_Del_ActiveEnergy: number;
  @Prop() U5_PLC_Del_ActiveEnergy: number;
  @Prop() U6_PLC_Del_ActiveEnergy: number;
  @Prop() U7_PLC_Del_ActiveEnergy: number;
  @Prop() U8_PLC_Del_ActiveEnergy: number;
  @Prop() U9_PLC_Del_ActiveEnergy: number;
  @Prop() U10_PLC_Del_ActiveEnergy: number;
  @Prop() U11_PLC_Del_ActiveEnergy: number;
  @Prop() U12_PLC_Del_ActiveEnergy: number;
  @Prop() U13_PLC_Del_ActiveEnergy: number;
  @Prop() U14_PLC_Del_ActiveEnergy: number;
  @Prop() U15_PLC_Del_ActiveEnergy: number;
  @Prop() U16_PLC_Del_ActiveEnergy: number;
  @Prop() U17_PLC_Del_ActiveEnergy: number;
  @Prop() U18_PLC_Del_ActiveEnergy: number;
  @Prop() U20_PLC_Del_ActiveEnergy: number;

}

export const Unit4LT1Schema = SchemaFactory.createForClass(Unit4LT1);
