// src/node_red_link/node-red-link.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { NodeRedStatus1, NodeRedStatusSchema } from './schemas/node-red-status.schema';
import { NodeRedLinkService } from './node_red_link.service';
import { NodeRedLinkController } from './node_red_link.controller';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature(
      [{ name: NodeRedStatus1.name, schema: NodeRedStatusSchema }],
      'surajcotton'
    ),
  ],
  providers: [NodeRedLinkService],
  controllers: [NodeRedLinkController],
})
export class NodeRedLinkModule {}
