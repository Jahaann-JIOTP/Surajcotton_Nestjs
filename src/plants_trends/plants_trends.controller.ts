import { Controller, Get, Query } from '@nestjs/common';
import { PlantsTrendsService } from './plants_trends.service';

@Controller('plants-trends')
export class PlantsTrendsController {
  constructor(private readonly plantsTrendsService: PlantsTrendsService) {}

  @Get('unit4-lt1')
  async getUnit4LT1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getUnit4LT1Trends(startDate, endDate);
  }
}
