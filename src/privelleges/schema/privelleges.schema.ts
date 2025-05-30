import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PrivellegesDocument = HydratedDocument<Privelleges>;

@Schema({ timestamps: true })
export class Privelleges {
  @Prop({ unique: true })
  name: string;
  id: any;
}
export const PrivellegesSchema = SchemaFactory.createForClass(Privelleges);
