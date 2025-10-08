import { Controller, Get, UseGuards } from '@nestjs/common';
import { NodeRedLinkService } from './node_red_link.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('node-red-link')
export class NodeRedLinkController {
  constructor(private readonly nodeRedLinkService: NodeRedLinkService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getNodeRedData() {
    return await this.nodeRedLinkService.fetchNodeRedData(); // assuming this method exists
  }
  @UseGuards(JwtAuthGuard)
  @Get('check-status')
  async checkLink() {
    const result = await this.nodeRedLinkService.checkNodeRedLink();
    return { message: result }; // show "Link is up" or "Link is down"
  }
}
