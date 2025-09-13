import { Controller, Post, Body } from '@nestjs/common';
import { DailyConsumptionService } from './daily_consumption.service';
import { ConsumptionDto } from './dto/consumption.dto';

@Controller()
export class DailyConsumptionController {
  constructor(private readonly service: DailyConsumptionService) {}

  // Unit4 endpoints
  @Post('Unit4-LT1-daily-consumption')
  async getUnit4LT1(@Body() dto: ConsumptionDto) {
    return this.service.calculateConsumption(dto, 'LT1');
  }

  @Post('Unit4-LT2-daily-consumption')
  async getUnit4LT2(@Body() dto: ConsumptionDto) {
    return this.service.calculateConsumption(dto, 'LT2');
  }

  // Unit5 endpoints
  @Post('Unit5-LT1-daily-consumption')
  async getUnit5LT1(@Body() dto: ConsumptionDto) {
    return this.service.calculateConsumption(dto, 'Unit5-LT1');
  }

  @Post('Unit5-LT2-daily-consumption')
  async getUnit5LT2(@Body() dto: ConsumptionDto) {
    return this.service.calculateConsumption(dto, 'Unit5-LT2');
  }
}
