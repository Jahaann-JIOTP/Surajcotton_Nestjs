// src/trends/trends.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { TrendsQueryDto } from './dto/trends-query.dto';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get()
  async getTrends(@Query() query: TrendsQueryDto) {
    const { start_date, end_date, meterId, suffixes } = query;
    const meterIds = meterId.split(',');
    const suffixList = suffixes.split(',');

    return this.trendsService.getTrendData(start_date, end_date, meterIds, suffixList);
  }
}
