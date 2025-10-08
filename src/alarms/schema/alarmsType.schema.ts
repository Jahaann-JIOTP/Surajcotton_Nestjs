import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'alarmsType' })
export class AlarmsType {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  priority: number;

  @Prop({ required: true })
  color: string;

  @Prop({ required: true })
  code: string;

  @Prop({ enum: ['Single', 'Both'], required: false })
  acknowledgeType?: 'Single' | 'Both';
}

export type AlarmsTypeDocument = AlarmsType & Document;
export const AlarmsTypeSchema = SchemaFactory.createForClass(AlarmsType);

// 👇 Add this after schema creation
AlarmsTypeSchema.index({ type: 1, priority: 1 }, { unique: true });

export const AlarmsTypeCollectionName = 'alarmsType';
