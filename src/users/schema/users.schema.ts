import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type UsersDocument = HydratedDocument<Users>;

@Schema({ timestamps: true })
export class Users {
  @Prop({ enum: ['active', 'inactive', 'banned'], default: 'active' })
  userStatus: string;

  @Prop({ type: Types.ObjectId, ref: 'Roles' })
  role: Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
  id: any;
  populate: any;

 @Prop({ type: Types.ObjectId, ref: 'Users' })
createdBy: Types.ObjectId;



  _id: Types.ObjectId;
}

export const UsersSchema = SchemaFactory.createForClass(Users);
