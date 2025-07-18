// import { Controller, Get, Query } from '@nestjs/common';
// import { HeatMapService } from './heat_map.service';
// import { HeatMapDto } from './dto/heat_map.dto';

// @Controller('heat-map')
// export class HeatMapController {
//   constructor(private readonly heatMapService: HeatMapService) {}

//   @Get('hourly')
//   async getHourlyConsumption(@Query() dto: HeatMapDto) {
//     return this.heatMapService.getHourlyConsumption(dto.start_date, dto.end_date);
//   }
// }

import { Controller, Get, Query } from '@nestjs/common';
import {  HeatMapService } from './heat_map.service';

@Controller()
export class HeatMapController {
  constructor(private readonly  HeatMapService:  HeatMapService) {}

  @Get('heat-map')
  async getConVsPro(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('label') label: string
  ) {
    return this. HeatMapService.getPowerData(startDate, endDate, label);
  }
}

