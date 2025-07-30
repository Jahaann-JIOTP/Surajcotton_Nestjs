// src/node_red_link/schemas/node-red-status.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class NodeRedStatus {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop()
  endTime?: Date;

  @Prop()
  message?: string;
}

export type NodeRedStatusDocument = NodeRedStatus & Document;

export const NodeRedStatusSchema = SchemaFactory.createForClass(NodeRedStatus);
