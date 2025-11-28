import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DailyConsumptionService } from './daily_consumption.service';
import { ConsumptionDto } from './dto/consumption.dto';
//  import { JwtAuthGuard } from 'src/auth/jwt.authguard';


@Controller()
export class DailyConsumptionController {
  constructor(private readonly service: DailyConsumptionService) {}
  @Post('departmentreport')
async getDepartmentDaily(@Body() dto: ConsumptionDto) {
  return this.service.getDepartmentDailySummary(dto);
}
}
