// src/energy-cost/energy-cost.controller.ts

import { Body, Controller, Post } from '@nestjs/common';
import { GetEnergyCostDto } from './dto/get-energy-cost.dto';
import { EnergyCostService } from './energy_cost.service';

@Controller('energy-cost')
export class EnergyCostController {
  constructor(private readonly energyCostService: EnergyCostService) {}

  @Post()
  async getCostData(@Body() dto: GetEnergyCostDto) {
    return this.energyCostService.getConsumptionData(dto);
  }
}
