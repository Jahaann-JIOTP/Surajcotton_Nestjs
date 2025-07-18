import { Controller, Get, Query } from '@nestjs/common';
import { HeatMapService } from './heat_map.service';

@Controller()
export class HeatMapController {
  constructor(private readonly heatMapService: HeatMapService) {}

  @Get('heat-map')
  async getHeatMapData(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string
  ) {
    return this.heatMapService.getPowerAverages(startDate, endDate);
  }
}
