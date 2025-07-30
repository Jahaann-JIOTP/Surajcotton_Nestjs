// src/node_red_link/node_red_link.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { NodeRedLinkController } from './node_red_link.controller';
import { NodeRedLinkService } from './node_red_link.service';
import { NodeRedStatus, NodeRedStatusSchema } from './schemas/node-red-status.schema';

@Module({
  imports: [
    HttpModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: NodeRedStatus.name, schema: NodeRedStatusSchema }],
       'surajcotton'
    ),
  ],
  controllers: [NodeRedLinkController],
  providers: [NodeRedLinkService],
})
export class NodeRedLinkModule {}
