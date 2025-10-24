import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { sankeyService } from './sankey.service';
import { sankeyDto } from './dto/sankey.dto';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller() // ❗ No prefix — allows independent endpoints
export class sankeyController {
  constructor(private readonly sankeyService: sankeyService) {}

  // ===================== MAIN SANKEY =====================
  @UseGuards(JwtAuthGuard)
  @Post('mainsankey')
  async getmainSankey(@Body() dto: sankeyDto) {
    return this.sankeyService.getmainSankey(dto);
  }

  // ===================== UNIT-WISE SANKEY =====================
  @UseGuards(JwtAuthGuard)
  @Post('unit4')
  async getUnit4Sankey(@Body() dto: sankeyDto) {
    return this.sankeyService.getUnit4Sankey(dto);
  }
   @UseGuards(JwtAuthGuard)
  @Post('unit5')
  async getUnit5Sankey(@Body() dto: sankeyDto) {
    return this.sankeyService.getUnit5Sankey(dto);
  }
  @UseGuards(JwtAuthGuard)
  @Post('losses-sankey')
  async getLossesSankey(@Body() dto: sankeyDto) {
    return this.sankeyService.getLossesSankey(dto);
  }
}
