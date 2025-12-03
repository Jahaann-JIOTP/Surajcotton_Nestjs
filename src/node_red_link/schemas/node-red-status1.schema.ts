// src/node_red_link/schemas/node-red-status.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NodeRedStatusDocument1 = NodeRedStatus1 & Document;

@Schema({ timestamps: false })
export class NodeRedStatus1 {
  @Prop({ required: true, enum: ['up', 'down', 'cache'] })
 status: 'up' | 'down' | 'cache';

  @Prop({ required: true })
  message: string;

  @Prop()
  startTime?: Date;

  @Prop()
  endTime?: Date;
}
export const NodeRedStatusSchema = SchemaFactory.createForClass(NodeRedStatus1);
