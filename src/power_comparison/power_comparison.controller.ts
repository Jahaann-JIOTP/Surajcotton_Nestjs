import { Controller, Get, Query } from '@nestjs/common';
import { powercomparisonService } from './power_comparison.service';

@Controller()
export class powercomparisonController {
  constructor(private readonly powercomparisonService: powercomparisonService) {}

  @Get('power_comparison')
  async getConVsPro(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('label') label: string
  ) {
    return this.powercomparisonService.getPowerData(startDate, endDate, label);
  }
}
