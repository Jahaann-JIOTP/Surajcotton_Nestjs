import { Controller, Get, Query } from '@nestjs/common';
import { PlantsTrendsService } from './plants_trends.service';

@Controller('plants-trends')
export class PlantsTrendsController {
  constructor(private readonly service: PlantsTrendsService) {}

  @Get('plants')
  async getPlantsTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string,
  ) {
    return this.service.getPlantsTrends(startDate, endDate, type);
  }

  @Get('unit4-lt1')
  async getUnit4LT1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string,
  ) {
    return this.service.getUnit4LT1Trends(startDate, endDate, type);
  }

  @Get('unit4-lt2')
  async getUnit4LT2(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string,
  ) {
    return this.service.getUnit4LT2Trends(startDate, endDate, type);
  }

  @Get('unit5-lt1')
  async getUnit5LT1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string,
  ) {
    return this.service.getUnit5LT1Trends(startDate, endDate, type);
  }

  @Get('unit5-lt2')
  async getUnit5LT2(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('type') type?: string,
  ) {
    return this.service.getUnit5LT2Trends(startDate, endDate, type);
  }
}
