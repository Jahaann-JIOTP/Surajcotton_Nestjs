// src/trends/trends.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Post()
  async getTrends(@Body() body: any) {
    const { start_date, end_date, meterId, suffixes, area, selection } = body;
    const meterIds = meterId.split(',');
    const suffixList = suffixes.split(',');

    return this.trendsService.getTrendData(start_date, end_date, meterIds, suffixList, area, selection);
  }
}
