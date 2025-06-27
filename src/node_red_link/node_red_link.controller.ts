import { Controller, Get } from '@nestjs/common';
import { NodeRedLinkService } from './node_red_link.service';

@Controller('node-red-link') // ✅ this sets the route
export class NodeRedLinkController {
  constructor(private readonly nodeRedLinkService: NodeRedLinkService) {}

  @Get()
  async getNodeRedData() {
    return await this.nodeRedLinkService.fetchNodeRedData();
  }
}
