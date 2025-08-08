import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HeatMapService } from './heat_map.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller()
export class HeatMapController {
  constructor(private readonly heatMapService: HeatMapService) {}

  @UseGuards(JwtAuthGuard)
  @Get('heat-map')
  async getHeatMapData(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string
  ) {
    return this.heatMapService.getPowerAverages(startDate, endDate);
  }
}
