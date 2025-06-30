

import { Body, Controller, Post } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { EnergyUsageReportService } from './energy_usage_report.service';

@Controller('energy-usage-report')
export class EnergyUsageReportController {
  constructor(private readonly energyCostService:  EnergyUsageReportService) {}

  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
