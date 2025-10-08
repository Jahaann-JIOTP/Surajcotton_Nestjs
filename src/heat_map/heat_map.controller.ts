import { Controller, Get, Query, UseGuards, Post, Body, Param } from '@nestjs/common';
import { HeatMapService } from './heat_map.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';
import { CreateTransformerInputDto } from './dto/create-transformer-input.dto';


@Controller()
export class HeatMapController {
  constructor(private readonly heatMapService: HeatMapService)
   {}

  @UseGuards(JwtAuthGuard)
  @Get('heat-map')
  async getHeatMapData(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string
  ) {
    return this.heatMapService.getPowerAverages(startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
 @Post('heat-map/transformers')
  create(@Body() dto: CreateTransformerInputDto) {
    return this.heatMapService.create(dto);   // <- was this.svc
  }

  @UseGuards(JwtAuthGuard)
 @Get('heat-map/transformers/:name')
  async getLatestTransformerValue(@Param('name') name: string) {
    return this.heatMapService.latestFor(name);
  }
}
