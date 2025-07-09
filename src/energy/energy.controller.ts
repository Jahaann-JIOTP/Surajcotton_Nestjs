// src/energy/energy.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { EnergyService } from './energy.service';
import { EnergyQueryDto } from './dto/energy-query.dto';

@Controller('energy')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Get('consumption')
  async getEnergyData(@Query() query: EnergyQueryDto) {
    return await this.energyService.getConsumption(query.start_date, query.end_date);
  }
}
