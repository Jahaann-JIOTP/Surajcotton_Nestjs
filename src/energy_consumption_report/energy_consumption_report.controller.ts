

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { EnergyconsumptionreportService } from './energy_consumption_report.service';
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('energy-consumption-report')
export class EnergyconsumptionreportController {
  constructor(private readonly energyCostService:  EnergyconsumptionreportService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
