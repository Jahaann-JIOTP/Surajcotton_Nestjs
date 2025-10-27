import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterConfigurationDocument = MeterConfiguration & Document;

@Schema({ timestamps: true, strict: false, collection: 'meterconfigurations'})    // meterconfigurations for local server // for production server Toggle-logs
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

// meter-configuration.schema.ts
MeterConfigurationSchema.index({ assignedAt: -1 });
MeterConfigurationSchema.index({ meterId: 1, assignedAt: -1 });