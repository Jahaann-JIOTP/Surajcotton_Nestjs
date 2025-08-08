
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-power_summary-report.dto';
import { PowerSummaryReportService } from './power_summary_report.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';

@Controller('power_summary_report')
export class PowerSummaryReportController {
  constructor(private readonly energyCostService: PowerSummaryReportService) {}
  
  @UseGuards(JwtAuthGuard)
  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
