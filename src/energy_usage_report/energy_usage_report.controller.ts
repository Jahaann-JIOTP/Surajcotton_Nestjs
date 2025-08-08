

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { EnergyUsageReportService } from './energy_usage_report.service';
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('energy-usage-report')
export class EnergyUsageReportController {
  constructor(private readonly energyCostService:  EnergyUsageReportService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
