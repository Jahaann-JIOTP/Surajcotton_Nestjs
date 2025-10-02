import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterConfigurationDocument = MeterConfiguration & Document;

@Schema({ timestamps: true, strict: false, collection: 'Toggle-logs'})
// @Schema()  
   
export class MeterConfiguration {
  @Prop({ required: true })
  meterId: string;

  @Prop({ required: true })
  area: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  username: string;

  @Prop({ default: () => new Date() })
  assignedAt: Date;
}

export const MeterConfigurationSchema = SchemaFactory.createForClass(MeterConfiguration);
