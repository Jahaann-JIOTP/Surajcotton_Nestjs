import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RolesDocument = HydratedDocument<Roles>;

@Schema({ timestamps: true })
export class Roles {
  @Prop({ unique: true })
  name: string;
  @Prop({ type: [Types.ObjectId], ref: 'Privelleges' })
  privelleges: Types.ObjectId[];
  id: any;
}

export const RolesSchema = SchemaFactory.createForClass(Roles);
