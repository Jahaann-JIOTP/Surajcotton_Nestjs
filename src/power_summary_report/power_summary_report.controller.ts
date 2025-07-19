
import { Body, Controller, Post } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-power_summary-report.dto';
import { PowerSummaryReportService } from './power_summary_report.service';

@Controller('power_summary_report')
export class PowerSummaryReportController {
  constructor(private readonly energyCostService: PowerSummaryReportService) {}

  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
