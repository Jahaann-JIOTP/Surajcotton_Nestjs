// src/node_red_link/node_red_link.controller.ts
import { Controller, Get } from '@nestjs/common';
import { NodeRedLinkService } from './node_red_link.service';

@Controller('node-red-link')
export class NodeRedLinkController {
  constructor(private readonly nodeRedLinkService: NodeRedLinkService) {}

  @Get()
  async getNodeRedStatus() {
    return this.nodeRedLinkService.fetchNodeRedData();
  }
}
