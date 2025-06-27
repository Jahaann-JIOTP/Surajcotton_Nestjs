import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NodeRedLinkController } from './node_red_link.controller';
import { NodeRedLinkService } from './node_red_link.service';

@Module({
  imports: [HttpModule],
  controllers: [NodeRedLinkController],
  providers: [NodeRedLinkService],
})
export class NodeRedLinkModule {}
