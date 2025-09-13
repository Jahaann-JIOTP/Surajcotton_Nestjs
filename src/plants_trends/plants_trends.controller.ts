import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlantsTrendsService } from './plants_trends.service';
 import { JwtAuthGuard  } from 'src/auth/jwt.authguard';


@Controller('plants-trends')
export class PlantsTrendsController {
  constructor(private readonly plantsTrendsService: PlantsTrendsService) {}

  @UseGuards(JwtAuthGuard)
    @Get('Plants')
  async getplants(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getplants(startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unit4-lt1')
  async getUnit4LT1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getUnit4LT1Trends(startDate, endDate);
  }
   
  @UseGuards(JwtAuthGuard)
   @Get('unit4-lt2')
  async getUnit4LT2(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getUnit4LT2Trends(startDate, endDate);
  }


  @UseGuards(JwtAuthGuard)
  @Get('unit5-lt1')
  async getUnit5LT1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getUnit5LT1Trends(startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unit5-lt2')
  async getUnit5LT2(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.plantsTrendsService.getUnit5LT2Trends(startDate, endDate);
  }
}
