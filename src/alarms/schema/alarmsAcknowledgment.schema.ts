import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class AlarmAcknowledgement {
  @Prop({ required: true }) action: string[];
  @Prop({ required: true }) by: string;
  @Prop({ required: true }) delay: string;
}

export const AlarmAcknowledgementSchema =
  SchemaFactory.createForClass(AlarmAcknowledgement);
