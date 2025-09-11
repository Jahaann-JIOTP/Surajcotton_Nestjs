
import { Controller, Post, Body } from '@nestjs/common';
import { DailyConsumptionService } from './daily_consumption.service';
import { ConsumptionDto } from './dto/consumption.dto';

@Controller('Unit4-LT1-daily-consumption')
export class DailyConsumptionController {
  constructor(private readonly consumptionService: DailyConsumptionService) {}

  @Post()
  async getConsumption(@Body() dto: ConsumptionDto) {
    return this.consumptionService.calculateConsumption(dto);
  }
}
