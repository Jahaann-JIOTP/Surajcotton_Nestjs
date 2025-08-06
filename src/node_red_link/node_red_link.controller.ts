import { Controller, Get } from '@nestjs/common';
import { NodeRedLinkService } from './node_red_link.service';

@Controller('node-red-link')
export class NodeRedLinkController {
  constructor(private readonly nodeRedLinkService: NodeRedLinkService) {}

  @Get()
  async getNodeRedData() {
    return await this.nodeRedLinkService.fetchNodeRedData(); // assuming this method exists
  }

  @Get('check-status')
  async checkLink() {
    const result = await this.nodeRedLinkService.checkNodeRedLink();
    return { message: result }; // show "Link is up" or "Link is down"
  }
}
