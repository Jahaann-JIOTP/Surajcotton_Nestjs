// src/node_red_link/schemas/node-red-status.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NodeRedStatusDocument1 = NodeRedStatus1 & Document;

@Schema({})
export class NodeRedStatus1 {
  @Prop({ required: true })
  status: 'up' | 'down';

  @Prop()
  message: string;

  @Prop()
  startTime: Date;

  @Prop()
  endTime: Date;
}

export const NodeRedStatusSchema = SchemaFactory.createForClass(NodeRedStatus1);
