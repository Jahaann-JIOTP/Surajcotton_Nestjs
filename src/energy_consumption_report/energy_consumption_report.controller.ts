

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { EnergyconsumptionreportService } from './energy_consumption_report.service';
 import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('energy-consumption-report')
export class EnergyconsumptionreportController {
  constructor(private readonly energyCostService:  EnergyconsumptionreportService) {}

  // @UseGuards(JwtAuthGuard)
  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
 // ⬇️⬇️ ADD THIS NEW ENDPOINT HERE
@UseGuards(JwtAuthGuard)
@Post('unit-only')
async getUnitOnlyConsumption(@Body() dto: GetEnergyCostDto) {
  const report = await this.energyCostService.getConsumptionData(dto);

  const daily = report?.dailyConsumption ?? [];
  const production = report?.productionSummary ?? [];

  const unit4Daily = daily.find((x: any) => x.Unit === 4) || {};
  const unit5Daily = daily.find((x: any) => x.Unit === 5) || {};

  const unit4Production = production.find((x: any) => x.Unit === 4) || {};
  const unit5Production = production.find((x: any) => x.Unit === 5) || {};

  return {
    Unit_4_Consumption: unit4Daily.Total_Consumption || 0,
    Unit_4_ConsumptionPerBag: unit4Production.consumptionperbag || 0,
    Unit_5_Consumption: unit5Daily.Total_Consumption || 0,
    Unit_5_ConsumptionPerBag: unit5Production.consumptionperbag || 0,
  };
}


}
