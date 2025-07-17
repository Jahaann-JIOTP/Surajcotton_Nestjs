import { Controller, Get, Query } from '@nestjs/common';
import { HeatMapService } from './heat_map.service';
import { HourlyConsumption } from './dto/hourly-consumption.interface';


@Controller('heat-map')
export class HeatMapController {
  constructor(private readonly heatMapService: HeatMapService) {}
@Get('hourly-consumption')
async getHourlyConsumption(
  @Query('startDate') startDate: string,
  @Query('endDate') endDate: string,
  @Query('tag') tag: string,
): Promise<HourlyConsumption[]> {
  return this.heatMapService.getHourlyConsumption(startDate, endDate, tag);
}


}
